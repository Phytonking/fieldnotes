import { eveChannel } from 'eve/channels/eve'
import { none } from 'eve/channels/auth'

export default eveChannel({
  // This workspace deliberately exposes synthetic records for its hackathon demo.
  // Replace with verified officer and case-scoped authorization before real use.
  auth: [none()],
})
