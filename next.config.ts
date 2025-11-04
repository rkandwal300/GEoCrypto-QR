
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https' as const,
        hostname: 'maps.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'www.openstreetmap.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' as const,
        hostname: 'tile.openstreetmap.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This is to allow cross-origin requests in development.
    // In a future version of Next.js, this will be required.
    allowedDevOrigins: [
        "https://9000-firebase-studio-1761488430567.cluster-sumfw3zmzzhzkx4mpvz3ogth4y.cloudworkstations.dev"
    ]
  }
};

export default nextConfig;

    
