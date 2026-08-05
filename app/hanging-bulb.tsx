"use client";

import { useEffect, useState } from "react";

export function HangingBulb() {
  const [lit, setLit] = useState(false);
  const [hovered, setHovered] = useState(false);
  const glowing = lit || hovered;
  useEffect(() => {
    document.documentElement.dataset.theme = lit ? "dark" : "light";
  }, [lit]);
  return <button type="button" aria-pressed={lit} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} onClick={() => setLit((value) => !value)} aria-label={lit ? "Apagar foco" : "Encender foco"} className="relative mx-auto block h-[258px] w-[116px] cursor-pointer">
    <span className="absolute left-0 top-0 block h-[355px] w-40 origin-top-left scale-[.72]">
    <span className="absolute left-[75px] top-0 h-[188px] w-[7px] rounded-full border-x border-[#062b31] bg-gradient-to-r from-[#062b31] via-[#b3d0cb] to-[#163f43] shadow-[1px_0_2px_rgba(255,255,255,.8)]" />
    <span className="absolute left-[63px] top-0 h-5 w-9 rounded-b-md border-x-2 border-b-2 border-[#062b31] bg-gradient-to-r from-[#789795] via-[#e8f7f4] to-[#466967]" />
    <span className="absolute left-[68px] top-[178px] h-7 w-9 rounded-t-md border-2 border-[#062b31] bg-gradient-to-r from-[#001c20] via-[#416766] to-[#082d31]" />
    <span className={`absolute left-1 top-[187px] h-40 w-40 rounded-full transition-all duration-500 ${glowing ? "bg-[#ffd85a]/30 blur-xl" : "bg-transparent"}`} />
    <svg viewBox="0 0 160 170" className={`absolute left-0 top-[180px] h-[170px] w-40 transition-all duration-500 ${glowing ? "drop-shadow-[0_0_28px_rgba(255,202,55,.95)]" : "drop-shadow-[5px_12px_8px_rgba(6,43,49,.27)]"}`} aria-hidden="true">
      <defs>
        <radialGradient id="glass" cx="34%" cy="25%" r="74%"><stop offset="0" stopColor="#ffffff" /><stop offset=".25" stopColor={glowing ? "#fff9cd" : "#f9fcfb"} /><stop offset=".72" stopColor={glowing ? "#ffe16e" : "#bfd0cd"} /><stop offset="1" stopColor={glowing ? "#d99c25" : "#71898a"} /></radialGradient>
        <linearGradient id="metal" x1="0" x2="1"><stop stopColor="#001c20" /><stop offset=".45" stopColor="#4b7170" /><stop offset=".65" stopColor="#d6eeea" /><stop offset="1" stopColor="#062b31" /></linearGradient>
      </defs>
      <g transform="rotate(180 80 85)">
        <path d="M80 10C47 10 27 35 27 66c0 23 12 37 25 49 6 6 8 13 9 22h38c1-9 3-16 9-22 13-12 25-26 25-49C133 35 113 10 80 10Z" fill="url(#glass)" stroke="#062b31" strokeWidth="5" />
        <ellipse cx="60" cy="46" rx="10" ry="19" fill="#fff" opacity={glowing ? ".72" : ".42"} transform="rotate(-26 60 46)" />
        <path d="M59 86c3-17 12-27 21-27s18 10 21 27M68 96h24M69 111h22" fill="none" stroke={glowing ? "#bc6810" : "#597173"} strokeWidth="3" strokeLinecap="round" />
        <path d="M72 58v28m16-28v28" stroke={glowing ? "#d88616" : "#597173"} strokeWidth="3" strokeLinecap="round" />
        <path d="M59 137h42l-4 17H63l-4-17Z" fill="url(#metal)" />
        <path d="M64 142h32M65 148h30" stroke="#b8eddf" strokeWidth="2" opacity=".65" />
      </g>
    </svg>
    </span>
  </button>;
}
