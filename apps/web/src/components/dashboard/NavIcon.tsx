const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  sparkles:
    "M9.5 3 11 6.5 14.5 8 11 9.5 9.5 13 8 9.5 4.5 8 8 6.5 9.5 3Zm8 6 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1 1-2.2Z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  edit: "m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z",
  message: "M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.6A7.96 7.96 0 0 1 21 12Z",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.2-1.7a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5c0 .4 0 .8-.1 1.2l2 1.5-1.5 2.6-2.3-.8a7.6 7.6 0 0 1-2 1.2l-.4 2.4h-3.4l-.4-2.4a7.6 7.6 0 0 1-2-1.2l-2.3.8-1.5-2.6 2-1.5a7.6 7.6 0 0 1 0-2.4l-2-1.5 1.5-2.6 2.3.8c.6-.5 1.3-.9 2-1.2l.4-2.4h3.4l.4 2.4c.7.3 1.4.7 2 1.2l2.3-.8 1.5 2.6-2 1.5c.1.4.1.8.1 1.2Z",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm9 2-4.3-4.3",
  trash:
    "M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13",
  download: "M12 3v12m0 0-4-4m4 4 4-4M5 19h14",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  save: "M5 4h11l3 3v13H5V4Zm3 0v5h8V4M8 14h8v6H8v-6Z",
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const d = PATHS[name] ?? PATHS.home;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
