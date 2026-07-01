/**
 * Telegram Bot API helper.
 * Sends survey results / summaries to the configured Telegram chat.
 *
 * Uses HTML parse mode (only <, >, & need escaping) — far more robust than
 * MarkdownV2 for messages containing lots of math symbols like n(A∪B∪C).
 */

const BOT_TOKEN = '8739961342:AAHz679HDcAs5yilXqwqRCWJC9TFPwy0dVw'
const CHAT_ID = '-1003833226240'

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

export interface SurveyStats {
  total: number
  telegram: number
  facebook: number
  instagram: number
  onlyTelegram: number
  onlyFacebook: number
  onlyInstagram: number
  telegramAndFacebook: number // A ∩ B (incl. triple)
  facebookAndInstagram: number // B ∩ C (incl. triple)
  telegramAndInstagram: number // A ∩ C (incl. triple)
  allThree: number // A ∩ B ∩ C
  none: number
  union: number // A ∪ B ∪ C
}

/** Escape HTML special characters for Telegram HTML parse mode. */
function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const B = (s: string | number) => `<b>${esc(s)}</b>`
const I = (s: string | number) => `<i>${esc(s)}</i>`

/**
 * Send a single respondent's submission to Telegram.
 */
export async function sendSubmissionToTelegram(
  nickname: string,
  platforms: { telegram: boolean; facebook: boolean; instagram: boolean },
  stats: SurveyStats,
): Promise<{ ok: boolean; error?: string }> {
  const chosen: string[] = []
  if (platforms.telegram) chosen.push('🔵 Telegram')
  if (platforms.facebook) chosen.push('👥 Facebook')
  if (platforms.instagram) chosen.push('📸 Instagram')
  const usedList = chosen.length > 0 ? chosen.join('  •  ') : 'ไม่ใช้แพลตฟอร์มใดเลย'

  const text =
    `📝 ${B('แบบสอบถาม: แพลตฟอร์มที่ใช้ในออนไลน์ไลฟ์')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${B('ผู้ตอบ:')} ${esc(nickname)}\n` +
    `💬 ${B('แพลตฟอร์มที่ใช้:')} ${esc(usedList)}\n\n` +
    `📊 ${B(`สรุปผลรวม (${stats.total} คน)`)}\n` +
    `• Telegram: ${stats.telegram} คน\n` +
    `• Facebook: ${stats.facebook} คน\n` +
    `• Instagram: ${stats.instagram} คน\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔄 ใช้อย่างน้อย 1 แพลตฟอร์ม: ${stats.union} คน\n` +
    `🚫 ไม่ใช้เลย: ${stats.none} คน\n` +
    I('กลุ่ม 4 — แผนภาพเวนน์')

  return sendText(text)
}

/**
 * Send the full aggregate summary to Telegram (called on demand / after each submit).
 */
export async function sendSummaryToTelegram(stats: SurveyStats): Promise<{ ok: boolean; error?: string }> {
  const abOnly = stats.telegramAndFacebook - stats.allThree
  const bcOnly = stats.facebookAndInstagram - stats.allThree
  const acOnly = stats.telegramAndInstagram - stats.allThree
  const sumCheck =
    stats.onlyTelegram +
    stats.onlyFacebook +
    stats.onlyInstagram +
    abOnly +
    bcOnly +
    acOnly +
    stats.allThree +
    stats.none

  const text =
    `📊 ${B('สรุปผลแบบสอบถามแพลตฟอร์มออนไลน์')}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 จำนวนผู้ตอบทั้งหมด (U): ${B(stats.total)} คน\n\n` +
    `${B('จำนวนผู้ใช้แต่ละแพลตฟอร์ม')}\n` +
    `• n(A) Telegram: ${stats.telegram} คน\n` +
    `• n(B) Facebook: ${stats.facebook} คน\n` +
    `• n(C) Instagram: ${stats.instagram} คน\n\n` +
    `${B('การใช้งานแต่ละส่วนในแผนภาพเวนน์')}\n` +
    `• ใช้ Telegram เท่านั้น: ${stats.onlyTelegram}\n` +
    `• ใช้ Facebook เท่านั้น: ${stats.onlyFacebook}\n` +
    `• ใช้ Instagram เท่านั้น: ${stats.onlyInstagram}\n` +
    `• Telegram ∩ Facebook (เท่านั้น): ${abOnly}\n` +
    `• Facebook ∩ Instagram (เท่านั้น): ${bcOnly}\n` +
    `• Telegram ∩ Instagram (เท่านั้น): ${acOnly}\n` +
    `• ใช้ทั้ง 3 แพลตฟอร์ม (A∩B∩C): ${stats.allThree}\n` +
    `• ไม่ใช้แพลตฟอร์มใดเลย: ${stats.none}\n\n` +
    `${B('สรุป')}\n` +
    `• n(A∪B∪C) = ${stats.union} คน\n` +
    `• ตรวจสอบ: ${sumCheck} = ${stats.total} ✓\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    I('กลุ่ม 4 — แผนภาพเวนน์ | แพลตฟอร์มที่ใช้ในออนไลน์ไลฟ์')

  return sendText(text)
}

async function sendText(html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    const data = (await res.json()) as { ok: boolean; description?: string; error_code?: number }
    if (!data.ok) {
      console.error('[telegram] sendMessage failed:', data.description, data.error_code)
      // Fallback: resend as plain text (strip HTML tags) so the message always lands.
      if (data.error_code === 400) {
        const plain = html.replace(/<\/?[a-zA-Z][^>]*>/g, '')
        const res2 = await fetch(`${API_BASE}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: plain,
            disable_web_page_preview: true,
          }),
        })
        const data2 = (await res2.json()) as { ok: boolean; description?: string }
        if (!data2.ok) return { ok: false, error: data2.description }
        return { ok: true }
      }
      return { ok: false, error: data.description }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[telegram] send error:', msg)
    return { ok: false, error: msg }
  }
}
