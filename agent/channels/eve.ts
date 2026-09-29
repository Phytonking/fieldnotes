import { eveChannel } from 'eve/channels/eve'
import { localDev, placeholderAuth, vercelOidc } from 'eve/channels/auth'

export default eveChannel({
  // Local browser use is enabled for development. Production stays fail-closed
  // until the app supplies real officer sign-in and case-scoped authorization.
  auth: [vercelOidc(), localDev(), placeholderAuth()],
})
