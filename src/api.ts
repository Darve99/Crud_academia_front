import type { Alumno, AlumnoInput, Materia, MateriaInput, Nota, NotaInput } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

type DumpImportResponse = {
  source: string;
  status: string;
  detail: string;
  importedAt: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const errorBody = (await response.json()) as { message?: string; validationErrors?: Record<string, string> };
      if (errorBody.validationErrors && Object.keys(errorBody.validationErrors).length > 0) {
        const validationMessage = Object.entries(errorBody.validationErrors)
          .map(([field, detail]) => `${field}: ${detail}`)
          .join(' | ');
        message = validationMessage;
      } else if (errorBody.message) {
        message = errorBody.message;
      }
    } catch {
      const text = await response.text();
      if (text.trim()) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  baseUrl: API_URL,
  getAlumnos: () => request<Alumno[]>('/api/alumnos'),
  createAlumno: (data: AlumnoInput) =>
    request<Alumno>('/api/alumnos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAlumno: (id: number, data: AlumnoInput) =>
    request<Alumno>(`/api/alumnos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAlumno: (id: number) =>
    request<void>(`/api/alumnos/${id}`, {
      method: 'DELETE',
    }),
  getMaterias: () => request<Materia[]>('/api/materias'),
  createMateria: (data: MateriaInput) =>
    request<Materia>('/api/materias', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMateria: (id: number, data: MateriaInput) =>
    request<Materia>(`/api/materias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMateria: (id: number) =>
    request<void>(`/api/materias/${id}`, {
      method: 'DELETE',
    }),
  createNota: (data: NotaInput) =>
    request<Nota>('/api/notas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getNotasByAlumno: (alumnoId: number, materiaId?: number) => {
    const query = materiaId ? `?materiaId=${materiaId}` : '';
    return request<Nota[]>(`/api/notas/alumno/${alumnoId}${query}`);
  },
  getAvailableDumps: () => request<string[]>('/api/import/dumps'),
  importBundledDump: (fileName: string) =>
    request<DumpImportResponse>(`/api/import/dumps/${encodeURIComponent(fileName)}`, {
      method: 'POST',
    }),
  importDumpFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<DumpImportResponse>('/api/import/dumps/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
