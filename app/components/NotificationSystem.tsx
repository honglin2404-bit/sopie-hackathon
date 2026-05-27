'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { Notification } from '../types/sop'

const NEWS_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0'
const ISSUE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1xUWGBiw9tBnZqrxjt4enL_oZ7LsU8QiWKhJOS5FbwrU/edit?gid=0#gid=0'
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sopie-search-tool.onrender.com'

// ----------------------------------------------------------------
// NotiCard
// ----------------------------------------------------------------
interface NotiCardProps {
  n: Notification
  onClose: (e: React.MouseEvent, id: number) => void
}

const NotiCard = React.memo(({ n, onClose }: NotiCardProps) => {
  let c = { border: '', text: '', bg: '', btn: '', ring: '' }
  if (n.theme === 'green')
    c = {
      border: 'border-green-500',
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      btn: 'bg-green-600 hover:bg-green-700',
      ring: 'bg-green-500',
    }
  else if (n.theme === 'orange')
    c = {
      border: 'border-orange-500',
      text: 'text-orange-700 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      btn: 'bg-orange-600 hover:bg-orange-700',
      ring: 'bg-orange-500',
    }
  else
    c = {
      border: 'border-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      btn: 'bg-blue-600 hover:bg-blue-700',
      ring: 'bg-blue-500',
    }

  return (
    <div
      className={`pointer-events-auto animate-in slide-in-from-bottom-5 duration-500 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border-t-4 ${c.border} ring-1 ring-black/5 text-gray-900 dark:text-white mb-4`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold ${c.text} text-sm uppercase`}>{n.header}</h3>
            <span className={`flex h-2 w-2 rounded-full ${c.ring} animate-pulse`} />
          </div>
          <button
            onClick={e => onClose(e, n.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>

        <div
          className={`${c.bg} p-3 rounded-xl mb-3 border border-gray-100 dark:border-gray-700/50`}
        >
          <p className="text-xs whitespace-pre-line font-medium leading-relaxed">
            {n.message.replace(/"/g, '')}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-400 italic font-medium">{n.time}</span>
          <div className="flex gap-2">
            <button
              onClick={e => onClose(e, n.id)}
              className="px-3 py-1.5 text-[10px] font-bold text-gray-500 border border-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Bỏ qua
            </button>
            <a
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => onClose(e as unknown as React.MouseEvent, n.id)}
              className={`px-3 py-1.5 text-[10px] font-bold text-white rounded shadow-sm ${c.btn}`}
            >
              {n.btnLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})
NotiCard.displayName = 'NotiCard'

// ----------------------------------------------------------------
// NotificationSystem
// ----------------------------------------------------------------
export const NotificationSystem = React.memo(() => {
  const [activeNotis, setActiveNotis] = useState<Notification[]>([])
  const [closedNotiIds, setClosedNotiIds] = useState<string[]>([])

  // Load closed IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sopie_closed_notis')
      if (saved) setClosedNotiIds(JSON.parse(saved).map((id: unknown) => String(id)))
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Polling với visibility-aware optimization
  useEffect(() => {
    const checkNewNoti = async () => {
      // [Enhancement #6] Không fetch khi tab đang ẩn — tiết kiệm request
      if (document.visibilityState === 'hidden') return

      try {
        const res = await fetch(`${BACKEND_URL}/api/get-latest-noti`)
        const data = await res.json()

        if (!data.success || !Array.isArray(data.notis)) return

        const validNotis: Notification[] = []
        const now = new Date()

        data.notis.forEach((noti: Notification) => {
          if (closedNotiIds.includes(String(noti.id))) return

          const createdTime = new Date(noti.created_at)
          const dd = String(createdTime.getDate()).padStart(2, '0')
          const mm = String(createdTime.getMonth() + 1).padStart(2, '0')
          const hh = String(createdTime.getHours()).padStart(2, '0')
          const min = String(createdTime.getMinutes()).padStart(2, '0')
          const fullTimeStr = `${dd}/${mm} ${hh}:${min}`

          if (noti.type === 'realtime' || !noti.type) {
            const expiry = new Date(createdTime)
            expiry.setHours(18, 0, 0, 0)
            if (now < expiry) {
              validNotis.push({
                ...noti,
                theme: 'blue',
                position: 'left',
                header: '⚡ HOT NEWS',
                time: `Lúc: ${fullTimeStr}`,
                url: NEWS_SHEET_URL,
                btnLabel: 'Xem ngay',
              })
            }
          } else if (noti.type === 'summary') {
            const dateMatch = noti.message.match(/ngày (\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              const d = parseInt(dateMatch[1])
              const m = parseInt(dateMatch[2]) - 1
              const y = parseInt(dateMatch[3])
              const expiry = new Date(y, m, d)
              expiry.setDate(expiry.getDate() + 1)
              expiry.setHours(15, 0, 0, 0)
              if (now < expiry) {
                validNotis.push({
                  ...noti,
                  theme: 'green',
                  position: 'left',
                  header: '📅 BẢN TIN NGÀY',
                  time: `Ngày: ${d}/${m + 1}`,
                  url: NEWS_SHEET_URL,
                  btnLabel: 'Xem ngay',
                })
              }
            }
          } else if (noti.type === 'issue') {
            const firstBr = noti.message.indexOf('\n')
            const title = firstBr !== -1 ? noti.message.substring(0, firstBr) : 'Lỗi hệ thống'
            const body = firstBr !== -1 ? noti.message.substring(firstBr + 1) : noti.message

            let issueDate = createdTime
            const dateMatch = noti.message.match(/Ngày phát hiện: (\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              issueDate = new Date(
                parseInt(dateMatch[3]),
                parseInt(dateMatch[2]) - 1,
                parseInt(dateMatch[1]),
              )
            }

            const expiry = new Date(issueDate)
            expiry.setDate(expiry.getDate() + 1)
            expiry.setHours(15, 0, 0, 0)
            if (now < expiry) {
              validNotis.push({
                ...noti,
                message: body,
                theme: 'orange',
                position: 'right',
                header: `🔴 ISSUE REPORT: ${title}`,
                time: `Gửi lúc: ${fullTimeStr}`,
                url: ISSUE_SHEET_URL,
                btnLabel: 'Xem ngay',
              })
            }
          }
        })

        validNotis.sort((a, b) => b.id - a.id)
        setActiveNotis(validNotis)
      } catch (e) {
        console.error(e)
      }
    }

    checkNewNoti()

    // [Enhancement #6] Tăng interval 30s → 60s
    const interval = setInterval(checkNewNoti, 60_000)

    // [Enhancement #6] Resume fetch ngay khi tab visible trở lại
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkNewNoti()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [closedNotiIds])

  const handleClose = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const idStr = String(id)
    setClosedNotiIds(prev => {
      if (prev.includes(idStr)) return prev
      const next = [...prev, idStr]
      try {
        localStorage.setItem('sopie_closed_notis', JSON.stringify(next))
      } catch {}
      return next
    })
    setActiveNotis(prev => prev.filter(n => String(n.id) !== idStr))
  }, [])

  if (activeNotis.length === 0) return null

  const leftNotis = activeNotis.filter(n => n.position === 'left')
  const rightNotis = activeNotis.filter(n => n.position === 'right')

  return (
    <>
      {/* [Enhancement #10] Ẩn notification popup trên mobile (< md) */}
      {leftNotis.length > 0 && (
        <div className="hidden md:flex fixed left-6 top-[220px] z-[9999] flex-col w-80 pointer-events-none font-sans">
          {leftNotis.map(n => (
            <NotiCard key={n.id} n={n} onClose={handleClose} />
          ))}
        </div>
      )}
      {rightNotis.length > 0 && (
        <div className="hidden md:flex fixed right-6 top-[220px] z-[9999] flex-col w-80 pointer-events-none font-sans">
          {rightNotis.map(n => (
            <NotiCard key={n.id} n={n} onClose={handleClose} />
          ))}
        </div>
      )}
    </>
  )
})
NotificationSystem.displayName = 'NotificationSystem'
