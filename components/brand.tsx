export function BinMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-9 w-9 shrink-0"
      fill="none"
    >
      <rect width="32" height="32" rx="6" fill="#0f2b22" />
      <path
        fill="#f4efe6"
        d="M9 11.5h14l-1.2 13.2a2 2 0 0 1-2 1.8H12.2a2 2 0 0 1-2-1.8L9 11.5Z"
      />
      <path fill="#d7ebe3" d="M8 11.2h16v2.1H8z" />
      <path
        stroke="#14382c"
        strokeWidth="1.4"
        d="M13 8.2h6c.8 0 1.4.6 1.4 1.4V11"
      />
      <circle cx="16" cy="19" r="1.3" fill="#14382c" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <BinMark />
      <div>
        <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-[#d7ebe3]">
          BRISBINS
        </p>
        <h1 className="text-xl font-semibold leading-tight text-white">
          Inventory
        </h1>
      </div>
    </div>
  );
}
