'use client';

import { useEffect, useState } from 'react';

/**
 * Toggle de tema claro/escuro do painel admin.
 * Persiste em localStorage ('ml-theme'). O anti-flash fica num <script>
 * inline no layout admin — aqui só sincronizamos o estado visual do botão.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('ml-theme', next ? 'dark' : 'light');
    } catch {
      /* localStorage indisponível */
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      aria-label="Alternar tema"
      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
    >
      {dark ? (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/** Conteúdo do <script> inline anti-flash — usar com dangerouslySetInnerHTML. */
export const THEME_INIT_SCRIPT =
  "(function(){try{if(localStorage.getItem('ml-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()";
