import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

let guardado = null // solo se guarda cuando se encontró un enlace

export function useGrupo() {
  const [enlace, setEnlace] = useState(guardado)
  const [listo, setListo] = useState(guardado !== null)

  useEffect(() => {
    if (guardado) return
    let vivo = true
    supabase.from('ajustes_app').select('valor').eq('clave', 'grupo_whatsapp').maybeSingle()
      .then(({ data }) => {
        const v = data?.valor
        const valido = typeof v === 'string' && v.startsWith('https://chat.whatsapp.com/') ? v : null
        if (valido) guardado = valido
        if (vivo) { setEnlace(valido); setListo(true) }
      })
    return () => { vivo = false }
  }, [])

  return { enlace, listo }
}