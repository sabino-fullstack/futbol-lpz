import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error en pantalla:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="space-y-3 rounded-xl border border-rojo p-4">
        <p className="font-bold">Algo salió mal en esta pantalla.</p>
        <p className="break-words text-sm text-suave">
          {String(this.state.error.message ?? this.state.error)}
        </p>
        <a href="/partidos" className="btn btn-activo">Ir a Partidos</a>
      </div>
    )
  }
}