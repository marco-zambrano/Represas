"use client";

import { useState } from "react";

export function HangingBulb() {
  const [lit, setLit] = useState(false);
  return <button type="button" aria-pressed={lit} onClick={() => setLit((value) => !value)} aria-label={lit ? "Apagar foco" : "Encender foco"} className="group absolute -top-16 right-0 z-10 h-[355px] w-40 cursor-pointer sm:right-10">
    <span className="absolute left-[77px] top-0 h-[188px] w-[3px] bg-[#314b4d] shadow-[1px_0_0_rgba(255,255,255,.7)]" />
    <span className="absolute left-[64px] top-0 h-5 w-8 rounded-b-md border-x-2 border-b-2 border-[#062b31] bg-[#d8e1de]" />
    <span className="absolute left-[71px] top-[178px] h-6 w-5 rounded-t-md bg-[#062b31]" />
    <span className={`absolute left-1 top-[187px] h-40 w-40 rounded-full transition-all duration-500 ${lit ? "bg-[#ffd85a]/25 blur-xl" : "bg-transparent"}`} />
    <svg viewBox="0 0 160 170" className={`absolute left-0 top-[180px] h-[170px] w-40 drop-shadow-xl transition-all duration-500 ${lit ? "drop-shadow-[0_0_24px_rgba(255,202,55,.9)]" : ""}`} aria-hidden="true">
      <path d="M80 10C47 10 27 35 27 66c0 23 12 37 25 49 6 6 8 13 9 22h38c1-9 3-16 9-22 13-12 25-26 25-49C133 35 113 10 80 10Z" fill={lit ? "#fff3a7" : "#e6ecea"} stroke="#062b31" strokeWidth="5" />
      <path d="M59 86c3-17 12-27 21-27s18 10 21 27M68 96h24M69 111h22" fill="none" stroke={lit ? "#de8e16" : "#71898a"} strokeWidth="3" strokeLinecap="round" />
      <path d="M72 58v28m16-28v28" stroke={lit ? "#e7a01f" : "#71898a"} strokeWidth="3" strokeLinecap="round" />
      <path d="M59 137h42l-4 17H63l-4-17Z" fill="#062b31" />
      <path d="M64 142h32M65 148h30" stroke="#b8eddf" strokeWidth="2" opacity=".65" />
    </svg>
    <span className="absolute bottom-0 left-0 w-full text-center text-xs font-bold text-[#527174] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{lit ? "Apagar luz" : "Encender luz"}</span>
  </button>;
}
