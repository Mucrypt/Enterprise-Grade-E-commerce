// ============================================
// Mega Menu Component (SHEIN/Amazon Style)
// ============================================

import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Flame, Zap } from 'lucide-react';
import { getPlaceholderImage } from '../../utils';

interface MegaMenuProps {
  categoryId: string;
}

// Menu data structure
const megaMenuData: Record<string, {
  title: string;
  sections: {
    title: string;
    links: { label: string; href: string; badge?: string }[];
  }[];
  featured?: {
    title: string;
    image: string;
    href: string;
    badge?: string;
  }[];
  banner?: {
    title: string;
    subtitle: string;
    image: string;
    href: string;
    bgColor: string;
  };
}> = {
  'all-categories': {
    title: 'All Categories',
    sections: [
      {
        title: 'Popular Categories',
        links: [
          { label: 'Lighting', href: '/category/lighting', badge: 'Hot' },
          { label: 'Audio & Entertainment', href: '/category/audio-entertainment' },
          { label: 'Safety & Security', href: '/category/safety-security' },
          { label: 'Tools & Emergency', href: '/category/tools-emergency' },
          { label: 'Phone & GPS Mounts', href: '/category/phone-gps-mounts' },
          { label: 'Interior Comfort', href: '/category/interior-comfort' },
        ],
      },
      {
        title: 'More Categories',
        links: [
          { label: 'Performance Parts', href: '/category/performance-parts' },
          { label: 'Exterior Accessories', href: '/category/exterior-accessories' },
          { label: 'Cleaning & Maintenance', href: '/category/cleaning-maintenance' },
          { label: 'Work & Safety Gear', href: '/category/work-safety-gear', badge: 'New' },
        ],
      },
    ],
    featured: [
      {
        title: 'LED Work Lights',
        image: getPlaceholderImage(300, 200, 'LED+Lights'),
        href: '/category/lighting',
        badge: 'Best Seller',
      },
      {
        title: 'Car Electronics',
        image: getPlaceholderImage(300, 200, 'Electronics'),
        href: '/category/audio-entertainment',
      },
    ],
  },
  lighting: {
    title: 'Lighting',
    sections: [
      {
        title: 'Headlights & Bulbs',
        links: [
          { label: 'LED Headlight Bulbs', href: '/category/lighting?type=headlights', badge: 'Popular' },
          { label: 'Halogen Bulbs', href: '/category/lighting?type=halogen' },
          { label: 'HID/Xenon Kits', href: '/category/lighting?type=hid' },
          { label: 'Fog Light Bulbs', href: '/category/lighting?type=fog' },
        ],
      },
      {
        title: 'Interior Lighting',
        links: [
          { label: 'LED Strip Lights', href: '/category/lighting?type=strips', badge: 'Hot' },
          { label: 'Dome Lights', href: '/category/lighting?type=dome' },
          { label: 'Ambient Lighting', href: '/category/lighting?type=ambient' },
          { label: 'Trunk Lights', href: '/category/lighting?type=trunk' },
        ],
      },
      {
        title: 'Work & Emergency',
        links: [
          { label: 'LED Work Glasses', href: '/category/work-safety-gear', badge: 'New' },
          { label: 'Headlamps', href: '/category/lighting?type=headlamps' },
          { label: 'Inspection Lights', href: '/category/lighting?type=inspection' },
          { label: 'Emergency Flares', href: '/category/lighting?type=emergency' },
        ],
      },
    ],
    banner: {
      title: 'HandiBeam LED Glasses',
      subtitle: 'Hands-free lighting for any project',
      image: getPlaceholderImage(400, 200, 'HandiBeam'),
      href: '/product/handibeam-led-safety-glasses',
      bgColor: 'from-yellow-400 to-orange-500',
    },
  },
  audio: {
    title: 'Audio & Entertainment',
    sections: [
      {
        title: 'Head Units',
        links: [
          { label: 'Apple CarPlay Stereos', href: '/category/audio-entertainment?type=carplay', badge: 'Popular' },
          { label: 'Android Auto Stereos', href: '/category/audio-entertainment?type=android' },
          { label: 'Single DIN', href: '/category/audio-entertainment?type=single-din' },
          { label: 'Double DIN', href: '/category/audio-entertainment?type=double-din' },
        ],
      },
      {
        title: 'Speakers & Sound',
        links: [
          { label: 'Component Speakers', href: '/category/audio-entertainment?type=component' },
          { label: 'Coaxial Speakers', href: '/category/audio-entertainment?type=coaxial' },
          { label: 'Subwoofers', href: '/category/audio-entertainment?type=subwoofers' },
          { label: 'Amplifiers', href: '/category/audio-entertainment?type=amplifiers' },
        ],
      },
    ],
  },
  safety: {
    title: 'Safety & Security',
    sections: [
      {
        title: 'Dash Cameras',
        links: [
          { label: '4K Dash Cams', href: '/category/safety-security?type=4k', badge: 'Best Seller' },
          { label: 'Dual Channel', href: '/category/safety-security?type=dual' },
          { label: 'Night Vision', href: '/category/safety-security?type=night-vision' },
          { label: 'Parking Mode', href: '/category/safety-security?type=parking' },
        ],
      },
      {
        title: 'Vehicle Security',
        links: [
          { label: 'GPS Trackers', href: '/category/safety-security?type=trackers' },
          { label: 'Car Alarms', href: '/category/safety-security?type=alarms' },
          { label: 'Steering Locks', href: '/category/safety-security?type=locks' },
          { label: 'Backup Cameras', href: '/category/safety-security?type=backup' },
        ],
      },
    ],
  },
  tools: {
    title: 'Tools & Emergency',
    sections: [
      {
        title: 'Power & Starting',
        links: [
          { label: 'Jump Starters', href: '/category/tools-emergency?type=jump-starters', badge: 'Essential' },
          { label: 'Battery Chargers', href: '/category/tools-emergency?type=chargers' },
          { label: 'Power Inverters', href: '/category/tools-emergency?type=inverters' },
        ],
      },
      {
        title: 'Tire Care',
        links: [
          { label: 'Tire Inflators', href: '/category/tools-emergency?type=inflators' },
          { label: 'Pressure Gauges', href: '/category/tools-emergency?type=gauges' },
          { label: 'Repair Kits', href: '/category/tools-emergency?type=repair' },
        ],
      },
      {
        title: 'Diagnostic Tools',
        links: [
          { label: 'OBD2 Scanners', href: '/category/tools-emergency?type=obd2', badge: 'Popular' },
          { label: 'Battery Testers', href: '/category/tools-emergency?type=battery-testers' },
          { label: 'Multimeters', href: '/category/tools-emergency?type=multimeters' },
        ],
      },
    ],
  },
  brands: {
    title: 'Shop by Brand',
    sections: [
      {
        title: 'Featured Brands',
        links: [
          { label: 'BrightBeam', href: '/brand/brightbeam', badge: 'Top Rated' },
          { label: 'AutoTech Pro', href: '/brand/autotech-pro' },
          { label: 'SoundWave Audio', href: '/brand/soundwave-audio' },
          { label: 'SafeGuard Auto', href: '/brand/safeguard-auto' },
        ],
      },
      {
        title: 'More Brands',
        links: [
          { label: 'PowerDrive', href: '/brand/powerdrive' },
          { label: 'CarCare Plus', href: '/brand/carcare-plus' },
          { label: 'LuxeRide', href: '/brand/luxeride' },
          { label: 'DriveMaster', href: '/brand/drivemaster' },
        ],
      },
    ],
  },
};

export default function MegaMenu({ categoryId }: MegaMenuProps) {
  const menuData = megaMenuData[categoryId] || megaMenuData['all-categories'];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Sections */}
        <div className="col-span-8">
          <div className="grid grid-cols-3 gap-8">
            {menuData.sections.map((section, idx) => (
              <div key={idx}>
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  {idx === 0 && <Flame className="w-4 h-4 text-orange-500" />}
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors group"
                      >
                        <span>{link.label}</span>
                        {link.badge && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                            {link.badge}
                          </span>
                        )}
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Banner */}
          {menuData.banner && (
            <Link
              to={menuData.banner.href}
              className={`mt-8 block rounded-xl overflow-hidden bg-linear-to-r ${menuData.banner.bgColor} p-6 text-white hover:shadow-lg transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90 flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Featured Product
                  </p>
                  <h3 className="text-2xl font-bold mt-1">{menuData.banner.title}</h3>
                  <p className="mt-1 opacity-90">{menuData.banner.subtitle}</p>
                  <span className="inline-flex items-center gap-1 mt-3 font-medium">
                    Shop Now <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
                <img
                  src={menuData.banner.image}
                  alt={menuData.banner.title}
                  className="w-40 h-24 object-cover rounded-lg"
                />
              </div>
            </Link>
          )}
        </div>

        {/* Featured Products */}
        {menuData.featured && (
          <div className="col-span-4">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Featured
            </h4>
            <div className="space-y-4">
              {menuData.featured.map((item, idx) => (
                <Link
                  key={idx}
                  to={item.href}
                  className="block relative rounded-xl overflow-hidden group"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    {item.badge && (
                      <span className="inline-block text-xs px-2 py-0.5 bg-orange-500 rounded-full mb-2">
                        {item.badge}
                      </span>
                    )}
                    <h5 className="font-semibold">{item.title}</h5>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
