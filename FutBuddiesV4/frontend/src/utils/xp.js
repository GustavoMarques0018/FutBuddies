// ============================================================
//  FutBuddies - Sistema XP / Níveis
//  Cálculo determinístico a partir de stats existentes na BD.
//  Não precisa coluna nova — derivamos no frontend.
// ============================================================

/**
 * Pesos dos eventos:
 *   - Jogo jogado:    10 XP
 *   - Golo marcado:    8 XP
 *   - Assistência:     5 XP
 *   - MVP do jogo:    25 XP
 *   - Vitória:         5 XP (bonus)
 *
 * Curva de níveis: cada nível N requer N*100 XP cumulativo
 * (Lvl 1 = 0-99, Lvl 2 = 100-299, Lvl 3 = 300-599, ...)
 *   xpAcumNivel(N) = 50 * N * (N - 1)
 */

export function calcularXP(u = {}) {
  const j = u.total_jogos || 0;
  const g = u.total_golos || 0;
  const a = u.total_assistencias || 0;
  const mvp = u.total_mvp || 0;
  const v = u.total_vitorias || 0;
  return j * 10 + g * 8 + a * 5 + mvp * 25 + v * 5;
}

export function xpParaNivel(nivel) {
  if (nivel <= 1) return 0;
  return 50 * nivel * (nivel - 1);
}

export function nivelDoXP(xp) {
  if (xp <= 0) return 1;
  // Inverter xpParaNivel: nivel = (1 + sqrt(1 + 8*xp/50)) / 2
  const n = Math.floor((1 + Math.sqrt(1 + (8 * xp) / 50)) / 2);
  return Math.max(1, n);
}

export function progressoNivel(xp) {
  const nivel = nivelDoXP(xp);
  const xpAtual = xpParaNivel(nivel);
  const xpProx  = xpParaNivel(nivel + 1);
  const total   = xpProx - xpAtual;
  const feito   = xp - xpAtual;
  return {
    nivel,
    xp,
    xpAtual,
    xpProx,
    progresso: total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0,
    faltam:    Math.max(0, xpProx - xp),
  };
}

// Títulos por nível (gamification)
export function tituloDoNivel(nivel) {
  if (nivel >= 30) return { nome: 'Lenda',         emoji: '👑', cor: '#fbbf24' };
  if (nivel >= 20) return { nome: 'Craque',        emoji: '⭐', cor: '#a78bfa' };
  if (nivel >= 12) return { nome: 'Veterano',      emoji: '🏆', cor: '#f97316' };
  if (nivel >= 7)  return { nome: 'Habilidoso',    emoji: '🔥', cor: '#ef4444' };
  if (nivel >= 4)  return { nome: 'Promissor',     emoji: '💪', cor: '#22c55e' };
  if (nivel >= 2)  return { nome: 'Iniciante',     emoji: '⚽', cor: '#39FF14' };
  return                  { nome: 'Recém-chegado', emoji: '🆕', cor: '#94a3b8' };
}
