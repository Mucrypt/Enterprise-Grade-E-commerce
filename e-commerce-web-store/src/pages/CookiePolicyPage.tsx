// ============================================
// Cookie Policy Page - Production Ready
// ============================================

import { Link } from 'react-router-dom';
import { Cookie, Settings, BarChart3, Target, Shield, ToggleLeft, HelpCircle, Mail } from 'lucide-react';
import { useConsentStore } from '../stores';

const sections = [
  { id: 'what-are-cookies', title: 'What Are Cookies', icon: Cookie },
  { id: 'types-of-cookies', title: 'Types of Cookies', icon: Settings },
  { id: 'how-we-use', title: 'How We Use Cookies', icon: BarChart3 },
  { id: 'third-party', title: 'Third-Party Cookies', icon: Target },
  { id: 'manage-cookies', title: 'Managing Cookies', icon: ToggleLeft },
  { id: 'your-choices', title: 'Your Choices', icon: Shield },
  { id: 'contact', title: 'Contact Us', icon: Mail },
];

// This table describes what we ACTUALLY use -- not a generic template. Most
// of our own storage is technically localStorage/sessionStorage rather than
// browser cookies, but we cover both here since EU guidance (ePrivacy
// Directive) treats them the same way for consent purposes.
const cookieTypes = [
  {
    name: 'Strictly Necessary',
    icon: '🔒',
    color: 'green',
    required: true,
    description: "Required for the site to work at all. Can't be switched off, and don't require consent under the ePrivacy Directive's necessity exemption.",
    examples: [
      { name: 'auth_token / refresh_token', purpose: 'Keeps you logged into your account (localStorage)', duration: 'Until you sign out' },
      { name: 'techtools-cart', purpose: 'Stores items in your shopping cart (localStorage)', duration: 'Until cleared' },
      { name: 'techtools-cookie-consent', purpose: 'Remembers your cookie preferences (localStorage)', duration: '1 year' },
      { name: '__stripe_mid / __stripe_sid', purpose: 'Stripe fraud-prevention during payment (cookie, set by js.stripe.com)', duration: 'Up to 1 year' },
    ],
  },
  {
    name: 'Functional',
    icon: '⚙️',
    color: 'blue',
    required: false,
    description: 'Optional features that make the site nicer to use. Off until you accept them in the cookie banner.',
    examples: [
      { name: 'Tawk.to widget cookies', purpose: 'Powers live chat support (only loaded for logged-in customers who accept this category)', duration: 'Set by Tawk.to, varies' },
    ],
  },
  {
    name: 'Analytics',
    icon: '📊',
    color: 'purple',
    required: false,
    description: 'Our own first-party analytics -- helps us see which pages/products get used. Off until you accept this category; nothing is queued or sent before then.',
    examples: [
      { name: 'analytics_utm', purpose: 'Remembers the campaign that brought you here, for the current session (sessionStorage)', duration: 'Browser session' },
      { name: 'In-memory session id', purpose: 'Groups your page views/product views together for our own reporting -- not shared with any third party', duration: 'Until you close the tab' },
    ],
  },
  {
    name: 'Marketing',
    icon: '📢',
    color: 'orange',
    required: false,
    description: "We don't currently use any advertising/marketing cookies or pixels (no Google Ads, Meta Pixel, TikTok Pixel, etc. are integrated today). This category exists so that if we add one in the future, it launches already gated behind your consent instead of retroactively.",
    examples: [],
  },
];

export default function CookiePolicyPage() {
  const lastUpdated = 'August 1, 2026';
  const effectiveDate = 'August 1, 2026';
  const openCookiePreferences = useConsentStore((state) => state.openPreferences);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-linear-to-br from-amber-600 via-orange-500 to-red-500 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Cookie className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto">
              We use cookies to enhance your browsing experience. This policy explains what cookies are, how we use them, and how you can manage your preferences.
            </p>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/70">
              <span>Last Updated: {lastUpdated}</span>
              <span className="w-1 h-1 bg-white/50 rounded-full" />
              <span>Effective: {effectiveDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            <span className="text-sm text-gray-500 shrink-0">Jump to:</span>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-amber-100 hover:text-amber-600 rounded-full transition-colors shrink-0"
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Quick Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quick Summary</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• We ask for your consent before anything non-essential loads -- nothing is assumed</li>
                  <li>• Strictly necessary cookies/storage (cart, login, payment fraud prevention) can't be disabled</li>
                  <li>• Functional (live chat) and Analytics (our own, first-party) are off until you opt in</li>
                  <li>• We don't currently use any advertising/marketing trackers</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 1: What Are Cookies */}
          <section id="what-are-cookies" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Cookie className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">1. What Are Cookies?</h2>
            </div>
            
            <div className="space-y-4 text-gray-600">
              <p>
                Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
              </p>
              
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">How Cookies Work</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">1️⃣</span>
                    </div>
                    <p>You visit our website</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">2️⃣</span>
                    </div>
                    <p>A small file is stored on your device</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">3️⃣</span>
                    </div>
                    <p>The cookie is sent back on future visits</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Similar Technologies</h3>
                <p>
                  In addition to cookies, we may use similar technologies such as:
                </p>
                <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                  <li><strong>Local Storage:</strong> Data stored in your browser that persists after you close it -- this is what we actually use for your cart, login session, and cookie preferences (see the table below)</li>
                  <li><strong>Session Storage:</strong> Data stored temporarily for a single browser session -- used for campaign attribution (UTM parameters) if you've accepted Analytics</li>
                </ul>
                <p className="text-sm text-gray-500 mt-2">
                  We don't use web beacons/pixel tags or device fingerprinting.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Types of Cookies */}
          <section id="types-of-cookies" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">2. Types of Cookies We Use</h2>
            </div>
            
            <div className="space-y-6">
              {cookieTypes.map((type) => (
                <div 
                  key={type.name} 
                  className={`border rounded-xl overflow-hidden ${
                    type.color === 'green' ? 'border-green-200' :
                    type.color === 'blue' ? 'border-blue-200' :
                    type.color === 'purple' ? 'border-purple-200' :
                    'border-orange-200'
                  }`}
                >
                  <div className={`p-4 ${
                    type.color === 'green' ? 'bg-green-50' :
                    type.color === 'blue' ? 'bg-blue-50' :
                    type.color === 'purple' ? 'bg-purple-50' :
                    'bg-orange-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{type.name} Cookies</h3>
                          {type.required && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Always Active</span>
                          )}
                        </div>
                      </div>
                      {!type.required && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <ToggleLeft className="w-5 h-5" />
                          <span>Configurable</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{type.description}</p>
                  </div>
                  
                  <div className="p-4 bg-white">
                    {type.examples.length === 0 ? (
                      <p className="text-sm text-gray-500">Nothing in this category is used today.</p>
                    ) : (
                      <>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">What's actually set:</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b">
                                <th className="pb-2 font-medium">Name</th>
                                <th className="pb-2 font-medium">Purpose</th>
                                <th className="pb-2 font-medium">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {type.examples.map((cookie) => (
                                <tr key={cookie.name}>
                                  <td className="py-2 font-mono text-xs bg-gray-100 px-2 rounded">{cookie.name}</td>
                                  <td className="py-2 px-2 text-gray-600">{cookie.purpose}</td>
                                  <td className="py-2 text-gray-500">{cookie.duration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: How We Use Cookies */}
          <section id="how-we-use" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">3. How We Use Cookies</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                We use cookies for various purposes to enhance your experience on our website:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">🛒 Shopping Experience</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Remember items in your cart</li>
                    <li>• Save products to your wishlist</li>
                    <li>• Show recently viewed products</li>
                    <li>• Enable quick checkout</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">👤 Personalization</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Remember your login details</li>
                    <li>• Store your preferences</li>
                    <li>• Show personalized recommendations</li>
                    <li>• Display relevant content</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">📈 Analytics</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Understand how you use our site</li>
                    <li>• Identify popular products/pages</li>
                    <li>• Measure marketing campaigns</li>
                    <li>• Improve website performance</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">🔒 Security</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Protect your account</li>
                    <li>• Prevent fraud</li>
                    <li>• Detect suspicious activity</li>
                    <li>• Ensure secure transactions</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Third-Party Cookies */}
          <section id="third-party" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">4. Third-Party Cookies</h2>
            </div>
            
            <div className="space-y-6">
              <p className="text-gray-600">
                We keep this list honest and short -- it only names services we
                actually use, not a generic list of what an online store
                might use.
              </p>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold">S</div>
                    <h4 className="font-semibold text-gray-900">Stripe</h4>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Strictly Necessary</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Our payment processor. Stripe's own script loads on every
                    page (not just checkout) and sets cookies used for
                    payment fraud prevention -- these are treated as
                    strictly necessary under the ePrivacy Directive and
                    aren't gated behind the consent banner.
                  </p>
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">
                    View Stripe's Privacy Policy →
                  </a>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-sky-500 rounded flex items-center justify-center text-white text-xs font-bold">T</div>
                    <h4 className="font-semibold text-gray-900">Tawk.to</h4>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Functional</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Our live chat support widget. Only loads for signed-in
                    customers who have accepted the Functional cookie
                    category -- never for anonymous visitors.
                  </p>
                  <a href="https://www.tawk.to/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">
                    View Tawk.to's Privacy Policy →
                  </a>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-600">
                  We do not currently use Google Analytics, Meta/Facebook
                  Pixel, TikTok Pixel, Hotjar, or any other analytics or
                  advertising service. If that changes, we'll update this
                  page first and it will be gated behind the Marketing
                  consent category, which is off by default.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Managing Cookies */}
          <section id="manage-cookies" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <ToggleLeft className="w-6 h-6 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">5. Managing Cookies</h2>
            </div>
            
            <div className="space-y-6">
              <p className="text-gray-600">
                You have several options for managing cookies on our website:
              </p>
              
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Cookie Preferences Center</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Use our Cookie Preferences Center to customize which types of cookies you allow. You can access this at any time by clicking the "Cookie Settings" link in our website footer, or the button below.
                </p>
                <button
                  onClick={openCookiePreferences}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                >
                  Open Cookie Settings
                </button>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Browser Settings</h3>
                <p className="text-gray-600 mb-4">
                  Most web browsers allow you to control cookies through their settings. Here's how to manage cookies in popular browsers:
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🌐</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Google Chrome</h4>
                      <p className="text-sm text-gray-500">View instructions →</p>
                    </div>
                  </a>
                  
                  <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🦊</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Mozilla Firefox</h4>
                      <p className="text-sm text-gray-500">View instructions →</p>
                    </div>
                  </a>
                  
                  <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🧭</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Safari</h4>
                      <p className="text-sm text-gray-500">View instructions →</p>
                    </div>
                  </a>
                  
                  <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🌊</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Microsoft Edge</h4>
                      <p className="text-sm text-gray-500">View instructions →</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Your Choices */}
          <section id="your-choices" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">6. Your Choices & Rights</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Opt-Out Options</h3>
                <p className="text-gray-600 mb-4">
                  You have the right to opt out of certain types of cookies and tracking:
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <span className="text-xl">🍪</span>
                    <div>
                      <h4 className="font-medium text-gray-900">Our Cookie Settings</h4>
                      <p className="text-sm text-gray-600">
                        The fastest way to control what we collect: use the{' '}
                        <button
                          onClick={openCookiePreferences}
                          className="text-orange-600 hover:underline"
                        >
                          Cookie Settings
                        </button>{' '}
                        panel to turn Functional and Analytics on or off at
                        any time -- takes effect immediately.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <span className="text-xl">📢</span>
                    <div>
                      <h4 className="font-medium text-gray-900">Third-Party Ad Opt-Outs</h4>
                      <p className="text-sm text-gray-600">
                        Not applicable today -- we don't run any advertising
                        or ad-retargeting integrations, so there's nothing to
                        opt out of on services like the Digital Advertising
                        Alliance or Your Online Choices.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Disabling cookies may affect the functionality of our website. Some features may not work properly if you disable all cookies.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7: Contact */}
          <section id="contact" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">7. Contact Us</h2>
            </div>
            
            <div className="space-y-6">
              <p className="text-gray-600">
                If you have any questions about our use of cookies or this Cookie Policy, please contact us:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Cookie Inquiries</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Email:</strong> <a href="mailto:[[PRIVACY_CONTACT_EMAIL]]" className="text-orange-600 hover:underline">[[PRIVACY_CONTACT_EMAIL]]</a></p>
                    <p><strong>Subject:</strong> Cookie Policy Inquiry</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">General Support</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Email:</strong> <a href="mailto:[[SUPPORT_CONTACT_EMAIL]]" className="text-orange-600 hover:underline">[[SUPPORT_CONTACT_EMAIL]]</a></p>
                    <p><strong>Phone:</strong> [[SUPPORT_PHONE_NUMBER]]</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Updates Section */}
          <section className="bg-white rounded-2xl p-8 shadow-sm mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Updates to This Policy</h2>
            <p className="text-gray-600">
              We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website with a new "Last Updated" date.
            </p>
          </section>

          {/* Related Links */}
          <div className="bg-linear-to-br from-amber-50 to-orange-50 rounded-2xl p-8 shadow-sm mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Related Policies</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Link 
                to="/privacy" 
                className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <span className="font-medium text-gray-900">Privacy Policy</span>
              </Link>
              
              <Link 
                to="/terms" 
                className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Terms of Service</span>
              </Link>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Have questions about cookies on our website?
            </p>
            <Link 
              to="/contact" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Contact Our Privacy Team
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
