// El chat vive en ChatBubble, montado una vez en el layout raíz. En el
// celular su botón flotante no se muestra (tapaba contenido y la barra de
// navegación), así que otras pantallas lo abren con este evento.
export const EVENTO_ABRIR_CHAT = 'gymlogic:abrir-chat'

export function abrirChat() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_CHAT))
}
