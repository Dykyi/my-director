export function download(blob: Blob, name: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
}

export const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');
