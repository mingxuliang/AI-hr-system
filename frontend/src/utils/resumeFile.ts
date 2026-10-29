const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.md', '.markdown'];

export const RESUME_ACCEPT = '.pdf,.doc,.docx,.txt,.md,.markdown';
export const RESUME_FORMAT_HINT = '支持 PDF、Word（doc/docx）、TXT、Markdown，不超过 10MB';

export function resumeFileError(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  if (!RESUME_EXTENSIONS.includes(ext)) {
    return '只支持 PDF、Word（doc/docx）、TXT、Markdown';
  }
  if (file.size > 10 * 1024 * 1024) {
    return '文件不能超过 10MB';
  }
  return null;
}
