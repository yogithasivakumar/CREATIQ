export interface Asset {
  id: string;
  projectId: string | null;
  prompt: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  createdAt: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}
