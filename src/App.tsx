import { useEffect, useState } from 'react';
import { api } from './api';
import type { Alumno, Materia, Nota } from './types';

type ThemePreference = 'system' | 'light' | 'dark';

type StudentFormState = {
  nombre: string;
  apellido: string;
  email: string;
  fechaNacimiento: string;
};

type SubjectFormState = {
  nombre: string;
  codigo: string;
  creditos: string;
};

type NoteFormState = {
  alumnoId: string;
  materiaId: string;
  valor: string;
};

type LeaderboardRow = {
  alumnoId: number;
  alumnoNombre: string;
  promedio: number;
  cantidad: number;
};

const emptyStudentForm: StudentFormState = {
  nombre: '',
  apellido: '',
  email: '',
  fechaNacimiento: '',
};

const emptySubjectForm: SubjectFormState = {
  nombre: '',
  codigo: '',
  creditos: '',
};

const emptyNoteForm: NoteFormState = {
  alumnoId: '',
  materiaId: '',
  valor: '',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildLeaderboard(
  alumnos: Alumno[],
  notesByAlumno: Record<number, Nota[]>,
  materiaId: number | '',
): LeaderboardRow[] {
  const rows = new Map<number, { alumnoNombre: string; suma: number; cantidad: number }>();

  for (const alumno of alumnos) {
    const notas = (notesByAlumno[alumno.id] ?? []).filter((nota) => {
      return materiaId === '' ? true : nota.materiaId === materiaId;
    });

    if (notas.length === 0) {
      continue;
    }

    const suma = notas.reduce((accumulator, nota) => accumulator + nota.valor, 0);
    rows.set(alumno.id, {
      alumnoNombre: `${alumno.nombre} ${alumno.apellido}`,
      suma,
      cantidad: notas.length,
    });
  }

  return [...rows.entries()]
    .map(([alumnoId, data]) => ({
      alumnoId,
      alumnoNombre: data.alumnoNombre,
      promedio: data.suma / data.cantidad,
      cantidad: data.cantidad,
    }))
    .sort((first, second) => {
      if (second.promedio !== first.promedio) {
        return second.promedio - first.promedio;
      }

      return second.cantidad - first.cantidad;
    })
    .slice(0, 5);
}

function App() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [notesByAlumno, setNotesByAlumno] = useState<Record<number, Nota[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'student' | 'subject' | 'note' | 'dump' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingAlumnoId, setEditingAlumnoId] = useState<number | null>(null);
  const [editingMateriaId, setEditingMateriaId] = useState<number | null>(null);
  const [availableDumps, setAvailableDumps] = useState<string[]>([]);
  const [selectedDumpName, setSelectedDumpName] = useState('sample-data.dump');
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<number | ''>('');
  const [selectedMateriaId, setSelectedMateriaId] = useState<number | ''>('');
  const [analyticsMateriaId, setAnalyticsMateriaId] = useState<number | ''>('');
  const [studentForm, setStudentForm] = useState<StudentFormState>(emptyStudentForm);
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(emptySubjectForm);
  const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm);
  const [lastSyncLabel, setLastSyncLabel] = useState('');
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const savedTheme = localStorage.getItem('themePreference');
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      return savedTheme;
    }
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  function getThemeLabel(preference: ThemePreference) {
    if (preference === 'light') {
      return 'Claro';
    }

    if (preference === 'dark') {
      return 'Oscuro';
    }

    return 'Sistema';
  }

  function cycleThemePreference() {
    setThemePreference((current) => {
      if (current === 'system') {
        return 'light';
      }

      if (current === 'light') {
        return 'dark';
      }

      return 'system';
    });
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [students, subjects, dumps] = await Promise.all([
        api.getAlumnos(),
        api.getMaterias(),
        api.getAvailableDumps().catch(() => [] as string[]),
      ]);
      const notesEntries = await Promise.all(
        students.map(async (alumno) => [alumno.id, await api.getNotasByAlumno(alumno.id)] as const),
      );

      setAlumnos(students);
      setMaterias(subjects);
      setAvailableDumps(dumps);
      if (dumps.length > 0 && !dumps.includes(selectedDumpName)) {
        setSelectedDumpName(dumps[0]);
      }
      setNotesByAlumno(Object.fromEntries(notesEntries) as Record<number, Nota[]>);
      setLastSyncLabel(
        new Intl.DateTimeFormat('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      );

      if (students.length > 0) {
        const currentStudentIsValid = typeof selectedAlumnoId === 'number' && students.some((alumno) => alumno.id === selectedAlumnoId);
        const fallbackStudentId = currentStudentIsValid ? selectedAlumnoId : students[0].id;
        setSelectedAlumnoId(fallbackStudentId);
        setNoteForm((current) => ({
          ...current,
          alumnoId: current.alumnoId && students.some((alumno) => alumno.id === Number(current.alumnoId)) ? current.alumnoId : String(fallbackStudentId),
        }));
      } else {
        setSelectedAlumnoId('');
        setNoteForm((current) => ({
          ...current,
          alumnoId: '',
        }));
      }

      if (subjects.length > 0) {
        const currentSubjectIsValid = typeof selectedMateriaId === 'number' && subjects.some((materia) => materia.id === selectedMateriaId);
        const fallbackSubjectId = currentSubjectIsValid ? selectedMateriaId : subjects[0].id;
        setSelectedMateriaId(fallbackSubjectId);
        setAnalyticsMateriaId((current) => {
          if (typeof current === 'number' && subjects.some((materia) => materia.id === current)) {
            return current;
          }

          return fallbackSubjectId;
        });
        setNoteForm((current) => ({
          ...current,
          materiaId: current.materiaId && subjects.some((materia) => materia.id === Number(current.materiaId)) ? current.materiaId : String(fallbackSubjectId),
        }));
      } else {
        setSelectedMateriaId('');
        setAnalyticsMateriaId('');
        setNoteForm((current) => ({
          ...current,
          materiaId: '',
        }));
      }

      setMessage('Datos sincronizados correctamente');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la informacion');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedAlumnoId !== '' && !alumnos.some((alumno) => alumno.id === selectedAlumnoId)) {
      setSelectedAlumnoId(alumnos[0]?.id ?? '');
    }
  }, [alumnos, selectedAlumnoId]);

  useEffect(() => {
    if (selectedMateriaId !== '' && !materias.some((materia) => materia.id === selectedMateriaId)) {
      setSelectedMateriaId(materias[0]?.id ?? '');
    }
  }, [materias, selectedMateriaId]);

  useEffect(() => {
    if (analyticsMateriaId !== '' && !materias.some((materia) => materia.id === analyticsMateriaId)) {
      setAnalyticsMateriaId(materias[0]?.id ?? '');
    }
  }, [materias, analyticsMateriaId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('themePreference', themePreference);

    const resolvedTheme = themePreference === 'system'
      ? (systemPrefersDark ? 'dark' : 'light')
      : themePreference;

    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-preference', themePreference);
  }, [themePreference, systemPrefersDark]);

  const allNotas = Object.values(notesByAlumno).flat();
  const studentNotes = selectedAlumnoId === '' ? [] : notesByAlumno[selectedAlumnoId] ?? [];
  const filteredNotes = selectedMateriaId === '' ? studentNotes : studentNotes.filter((nota) => nota.materiaId === selectedMateriaId);
  const leaderboard = buildLeaderboard(alumnos, notesByAlumno, analyticsMateriaId);
  const totalAverage = allNotas.length > 0 ? allNotas.reduce((accumulator, nota) => accumulator + nota.valor, 0) / allNotas.length : 0;

  async function handleStudentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('student');
    setError('');

    try {
      const payload = {
        nombre: studentForm.nombre.trim(),
        apellido: studentForm.apellido.trim(),
        email: studentForm.email.trim(),
        fechaNacimiento: studentForm.fechaNacimiento,
      };

      if (editingAlumnoId === null) {
        await api.createAlumno(payload);
        setMessage('Alumno creado correctamente');
      } else {
        await api.updateAlumno(editingAlumnoId, payload);
        setMessage('Alumno actualizado correctamente');
      }

      setStudentForm(emptyStudentForm);
      setEditingAlumnoId(null);
      await loadData();
    } catch (studentError) {
      setError(studentError instanceof Error ? studentError.message : 'No se pudo guardar el alumno');
    } finally {
      setSaving(null);
    }
  }

  async function handleSubjectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('subject');
    setError('');

    try {
      const payload = {
        nombre: subjectForm.nombre.trim(),
        codigo: subjectForm.codigo.trim(),
        creditos: Number(subjectForm.creditos),
      };

      if (editingMateriaId === null) {
        await api.createMateria(payload);
        setMessage('Materia creada correctamente');
      } else {
        await api.updateMateria(editingMateriaId, payload);
        setMessage('Materia actualizada correctamente');
      }

      setSubjectForm(emptySubjectForm);
      setEditingMateriaId(null);
      await loadData();
    } catch (subjectError) {
      setError(subjectError instanceof Error ? subjectError.message : 'No se pudo guardar la materia');
    } finally {
      setSaving(null);
    }
  }

  async function handleNoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('note');
    setError('');

    try {
      const payload = {
        valor: Number(noteForm.valor),
        alumnoId: Number(noteForm.alumnoId),
        materiaId: Number(noteForm.materiaId),
      };

      await api.createNota(payload);
      setMessage('Nota registrada correctamente');
      setNoteForm((current) => ({
        ...current,
        valor: '',
      }));
      await loadData();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : 'No se pudo registrar la nota');
    } finally {
      setSaving(null);
    }
  }

  async function handleImportBundledDump() {
    if (!selectedDumpName) {
      setError('Selecciona un dump de prueba para importar');
      return;
    }

    if (!window.confirm('La importacion reemplazara los datos actuales. ¿Deseas continuar?')) {
      return;
    }

    setSaving('dump');
    setError('');

    try {
      const response = await api.importBundledDump(selectedDumpName);
      setMessage(response.detail);
      await loadData();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo importar el dump de prueba');
    } finally {
      setSaving(null);
    }
  }

  async function handleUploadDump() {
    if (dumpFile === null) {
      setError('Selecciona un archivo .dump para importar');
      return;
    }

    if (!dumpFile.name.toLowerCase().endsWith('.dump')) {
      setError('El archivo debe tener extension .dump');
      return;
    }

    if (!window.confirm('La importacion reemplazara los datos actuales. ¿Deseas continuar?')) {
      return;
    }

    setSaving('dump');
    setError('');

    try {
      const response = await api.importDumpFile(dumpFile);
      setMessage(response.detail);
      setDumpFile(null);
      await loadData();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo importar el archivo .dump');
    } finally {
      setSaving(null);
    }
  }

  function editStudent(alumno: Alumno) {
    setEditingAlumnoId(alumno.id);
    setStudentForm({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      email: alumno.email,
      fechaNacimiento: alumno.fechaNacimiento,
    });
  }

  function editSubject(materia: Materia) {
    setEditingMateriaId(materia.id);
    setSubjectForm({
      nombre: materia.nombre,
      codigo: materia.codigo,
      creditos: String(materia.creditos),
    });
  }

  async function deleteStudent(id: number) {
    if (!window.confirm('¿Eliminar este alumno?')) {
      return;
    }

    setError('');

    try {
      await api.deleteAlumno(id);
      setMessage('Alumno eliminado correctamente');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el alumno');
    }
  }

  async function deleteSubject(id: number) {
    if (!window.confirm('¿Eliminar esta materia?')) {
      return;
    }

    setError('');

    try {
      await api.deleteMateria(id);
      setMessage('Materia eliminada correctamente');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la materia');
    }
  }

  const selectedAlumno = alumnos.find((alumno) => alumno.id === selectedAlumnoId);

  return (
    <div className="app-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">by darve99</p>
          <h1>CRUD Academia</h1>
          <p className="hero-text">
            Gestiona alumnos, materias y notas desde una interfaz web clara, reactiva y conectada a la API REST.
          </p>
          <div className="hero-actions">
            <span className="chip">API: {api.baseUrl}</span>
            <span className="chip">Última sincronización: {lastSyncLabel || 'Pendiente'}</span>
            <button
              type="button"
              className="ghost-button"
              onClick={cycleThemePreference}
              title="Alternar tema: Sistema -> Claro -> Oscuro"
            >
              Tema: {getThemeLabel(themePreference)}
            </button>
            <button type="button" className="ghost-button" onClick={() => void loadData()}>
              Sincronizar datos
            </button>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-stat">
            <span>Total alumnos</span>
            <strong>{alumnos.length}</strong>
          </div>
          <div className="hero-stat">
            <span>Total materias</span>
            <strong>{materias.length}</strong>
          </div>
          <div className="hero-stat">
            <span>Promedio general</span>
            <strong>{formatNumber(totalAverage || 0)}</strong>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        <article className="metric-card">
          <span>Alumnos</span>
          <strong>{alumnos.length}</strong>
        </article>
        <article className="metric-card">
          <span>Materias</span>
          <strong>{materias.length}</strong>
        </article>
        <article className="metric-card">
          <span>Notas</span>
          <strong>{allNotas.length}</strong>
        </article>
        <article className="metric-card accent">
          <span>Promedio global</span>
          <strong>{formatNumber(totalAverage || 0)}</strong>
        </article>
      </section>

      {(message || error) && (
        <section className="feedback-strip">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice danger">{error}</div>}
        </section>
      )}

      {loading && <div className="notice neutral">Cargando datos desde la API...</div>}

      <main className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Carga de datos de prueba</p>
              <h2>Importar archivo .dump</h2>
            </div>
          </div>

          <div className="stack-form">
            <div className="form-grid">
              <label className="field full-width">
                <span>Dumps incluidos en backend</span>
                <select
                  value={selectedDumpName}
                  onChange={(event) => setSelectedDumpName(event.target.value)}
                  disabled={availableDumps.length === 0}
                >
                  {availableDumps.length === 0 && <option value="">No hay dumps disponibles</option>}
                  {availableDumps.map((dumpName) => (
                    <option key={dumpName} value={dumpName}>
                      {dumpName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={saving === 'dump' || availableDumps.length === 0}
              onClick={() => void handleImportBundledDump()}
            >
              {saving === 'dump' ? 'Importando...' : 'Importar dump de prueba'}
            </button>

            <div className="form-grid">
              <label className="field full-width">
                <span>Subir archivo .dump local</span>
                <input
                  type="file"
                  accept=".dump"
                  onChange={(event) => setDumpFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <button
              className="ghost-button"
              type="button"
              disabled={saving === 'dump' || dumpFile === null}
              onClick={() => void handleUploadDump()}
            >
              {saving === 'dump' ? 'Importando...' : 'Importar archivo seleccionado'}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Gestión de alumnos</p>
              <h2>{editingAlumnoId === null ? 'Crear alumno' : 'Editar alumno'}</h2>
            </div>
            {editingAlumnoId !== null && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingAlumnoId(null);
                  setStudentForm(emptyStudentForm);
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form className="stack-form" onSubmit={(event) => void handleStudentSubmit(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={studentForm.nombre}
                  onChange={(event) => setStudentForm({ ...studentForm, nombre: event.target.value })}
                  placeholder="Ana"
                  required
                />
              </label>
              <label className="field">
                <span>Apellido</span>
                <input
                  type="text"
                  value={studentForm.apellido}
                  onChange={(event) => setStudentForm({ ...studentForm, apellido: event.target.value })}
                  placeholder="Pérez"
                  required
                />
              </label>
              <label className="field full-width">
                <span>Email</span>
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })}
                  placeholder="ana.perez@email.com"
                  required
                />
              </label>
              <label className="field full-width">
                <span>Fecha de nacimiento</span>
                <input
                  type="date"
                  value={studentForm.fechaNacimiento}
                  onChange={(event) => setStudentForm({ ...studentForm, fechaNacimiento: event.target.value })}
                  required
                />
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={saving === 'student'}>
              {saving === 'student' ? 'Guardando...' : editingAlumnoId === null ? 'Crear alumno' : 'Actualizar alumno'}
            </button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Email</th>
                  <th>Nacimiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">No hay alumnos registrados todavía.</div>
                    </td>
                  </tr>
                ) : (
                  alumnos.map((alumno) => (
                    <tr key={alumno.id}>
                      <td>
                        <strong>{alumno.nombre} {alumno.apellido}</strong>
                      </td>
                      <td>{alumno.email}</td>
                      <td>{formatDate(alumno.fechaNacimiento)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="text-button" onClick={() => editStudent(alumno)}>
                            Editar
                          </button>
                          <button type="button" className="text-button danger" onClick={() => void deleteStudent(alumno.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Gestión de materias</p>
              <h2>{editingMateriaId === null ? 'Crear materia' : 'Editar materia'}</h2>
            </div>
            {editingMateriaId !== null && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingMateriaId(null);
                  setSubjectForm(emptySubjectForm);
                }}
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form className="stack-form" onSubmit={(event) => void handleSubjectSubmit(event)}>
            <div className="form-grid">
              <label className="field full-width">
                <span>Nombre</span>
                <input
                  type="text"
                  value={subjectForm.nombre}
                  onChange={(event) => setSubjectForm({ ...subjectForm, nombre: event.target.value })}
                  placeholder="Matemáticas I"
                  required
                />
              </label>
              <label className="field">
                <span>Código</span>
                <input
                  type="text"
                  value={subjectForm.codigo}
                  onChange={(event) => setSubjectForm({ ...subjectForm, codigo: event.target.value })}
                  placeholder="MAT101"
                  required
                />
              </label>
              <label className="field">
                <span>Créditos</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={subjectForm.creditos}
                  onChange={(event) => setSubjectForm({ ...subjectForm, creditos: event.target.value })}
                  placeholder="4"
                  required
                />
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={saving === 'subject'}>
              {saving === 'subject' ? 'Guardando...' : editingMateriaId === null ? 'Crear materia' : 'Actualizar materia'}
            </button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Materia</th>
                  <th>Código</th>
                  <th>Créditos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {materias.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">No hay materias registradas todavía.</div>
                    </td>
                  </tr>
                ) : (
                  materias.map((materia) => (
                    <tr key={materia.id}>
                      <td>
                        <strong>{materia.nombre}</strong>
                      </td>
                      <td>{materia.codigo}</td>
                      <td>{materia.creditos}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="text-button" onClick={() => editSubject(materia)}>
                            Editar
                          </button>
                          <button type="button" className="text-button danger" onClick={() => void deleteSubject(materia.id)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Registro de notas</p>
              <h2>Registrar una nota</h2>
            </div>
          </div>

          <form className="stack-form" onSubmit={(event) => void handleNoteSubmit(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Alumno</span>
                <select
                  value={noteForm.alumnoId}
                  onChange={(event) => setNoteForm({ ...noteForm, alumnoId: event.target.value })}
                  required
                >
                  <option value="">Selecciona un alumno</option>
                  {alumnos.map((alumno) => (
                    <option key={alumno.id} value={alumno.id}>
                      {alumno.nombre} {alumno.apellido}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Materia</span>
                <select
                  value={noteForm.materiaId}
                  onChange={(event) => setNoteForm({ ...noteForm, materiaId: event.target.value })}
                  required
                >
                  <option value="">Selecciona una materia</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.codigo} - {materia.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full-width">
                <span>Valor</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={noteForm.valor}
                  onChange={(event) => setNoteForm({ ...noteForm, valor: event.target.value })}
                  placeholder="4.5"
                  required
                />
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={saving === 'note'}>
              {saving === 'note' ? 'Registrando...' : 'Registrar nota'}
            </button>
          </form>

          <div className="filter-row">
            <label className="field compact">
              <span>Alumno para consulta</span>
              <select
                value={selectedAlumnoId}
                onChange={(event) => setSelectedAlumnoId(event.target.value === '' ? '' : Number(event.target.value))}
              >
                <option value="">Todos</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.id} value={alumno.id}>
                    {alumno.nombre} {alumno.apellido}
                  </option>
                ))}
              </select>
            </label>
            <label className="field compact">
              <span>Materia para filtrar</span>
              <select
                value={selectedMateriaId}
                onChange={(event) => setSelectedMateriaId(event.target.value === '' ? '' : Number(event.target.value))}
              >
                <option value="">Todas</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.codigo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Materia</th>
                  <th>Valor</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="empty-state">
                        {selectedAlumno !== undefined
                          ? 'No hay notas para el alumno seleccionado.'
                          : 'Selecciona un alumno para revisar sus notas.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  [...filteredNotes]
                    .sort((first, second) => new Date(second.fechaRegistro).getTime() - new Date(first.fechaRegistro).getTime())
                    .map((nota) => (
                      <tr key={nota.id}>
                        <td>
                          <strong>{nota.materiaCodigo}</strong>
                          <div className="muted">{nota.materiaNombre}</div>
                        </td>
                        <td>
                          <span className={`score-pill ${nota.valor >= 4 ? 'score-high' : nota.valor >= 3 ? 'score-medium' : 'score-low'}`}>
                            {formatNumber(nota.valor)}
                          </span>
                        </td>
                        <td>{formatDate(nota.fechaRegistro)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Ranking académico</p>
              <h2>Mejores estudiantes por materia</h2>
            </div>
          </div>

          <div className="filter-row single">
            <label className="field compact full-width">
              <span>Materia para ranking</span>
              <select
                value={analyticsMateriaId}
                onChange={(event) => setAnalyticsMateriaId(event.target.value === '' ? '' : Number(event.target.value))}
              >
                <option value="">Todas las materias</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.codigo} - {materia.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {leaderboard.length === 0 ? (
            <div className="empty-state">
              No hay suficientes notas para calcular el ranking.
            </div>
          ) : (
            <div className="leaderboard">
              {leaderboard.map((row, index) => (
                <article key={row.alumnoId} className="leader-item">
                  <div className="leader-position">#{index + 1}</div>
                  <div>
                    <strong>{row.alumnoNombre}</strong>
                    <p>{row.cantidad} notas evaluadas</p>
                  </div>
                  <div className="leader-score">{formatNumber(row.promedio)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
