import { withEve } from 'eve/next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
}

export default withEve(nextConfig)
