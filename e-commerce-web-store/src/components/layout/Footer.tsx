// ============================================
// Footer Component (Modern E-commerce Style)
// ============================================

import { Link } from 'react-router-dom';
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';

const footerLinks = {
  shop: {
    title: 'Shop',
    links: [
      { label: 'New Arrivals', href: '/new-arrivals' },
      { label: 'Best Sellers', href: '/collections/best-sellers' },
      { label: 'Sale', href: '/sale' },
      { label: 'All Products', href: '/shop' },
      { label: 'Brands', href: '/brands' },
    ],
  },
  categories: {
    title: 'Categories',
    links: [
      { label: 'Lighting', href: '/category/lighting' },
      { label: 'Audio & Entertainment', href: '/category/audio-entertainment' },
      { label: 'Tools & Emergency', href: '/category/tools-emergency' },
      { label: 'Safety & Security', href: '/category/safety-security' },
      { label: 'Interior Comfort', href: '/category/interior-comfort' },
    ],
  },
  support: {
    title: 'Customer Service',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'FAQs', href: '/faq' },
      { label: 'Shipping Info', href: '/shipping' },
      { label: 'Returns & Refunds', href: '/returns' },
      { label: 'Track Order', href: '/track-order' },
    ],
  },
  company: {
    title: 'About Us',
    links: [
      { label: 'Our Story', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Affiliate Program', href: '/affiliates' },
      { label: 'Blog', href: '/blog' },
    ],
  },
};

const features = [
  {
    icon: Truck,
    title: 'Free Shipping',
    description: 'On orders over €50',
  },
  {
    icon: RotateCcw,
    title: '30-Day Returns',
    description: 'Hassle-free returns',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Payment',
    description: '100% secure checkout',
  },
  {
    icon: Phone,
    title: '24/7 Support',
    description: 'Dedicated support',
  },
];


export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Features Bar */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
                  <feature.icon className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-white mb-2">
              Subscribe to Our Newsletter
            </h3>
            <p className="text-gray-400 mb-6">
              Get exclusive deals, new arrivals, and 10% off your first order!
            </p>
            <form className="flex gap-2 max-w-md mx-auto">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                Subscribe
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold text-white">TechTools</span>
            </Link>
            <p className="text-gray-400 mb-6 max-w-xs">
              Your one-stop shop for premium automotive accessories, tools, and electronics. Quality products, unbeatable prices.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-3 text-sm">
              <a href="tel:+1234567890" className="flex items-center gap-3 hover:text-white transition-colors">
                <Phone className="w-4 h-4 text-orange-500" />
                +1 (234) 567-890
              </a>
              <a href="mailto:support@techtools.com" className="flex items-center gap-3 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-orange-500" />
                support@techtools.com
              </a>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <span>123 Tech Street, San Francisco, CA 94102, USA</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-white mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm hover:text-white hover:underline transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              © {currentYear} TechTools. All rights reserved.
            </p>

            {/* Payment Methods */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">We accept:</span>
              <div className="flex gap-2">
                {/* Payment icons placeholder */}
                <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center text-xs font-bold">
                  VISA
                </div>
                <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center text-xs font-bold">
                  MC
                </div>
                <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center text-xs font-bold">
                  PP
                </div>
              </div>
            </div>

            {/* Legal Links */}
            <div className="flex items-center gap-4 text-sm">
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link to="/cookies" className="hover:text-white transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
