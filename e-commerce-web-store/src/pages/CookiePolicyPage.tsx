// ============================================
// Cookie Policy Page - Production Ready
// ============================================

import { Link } from 'react-router-dom';
import { Cookie, Settings, BarChart3, Target, Shield, ToggleLeft, HelpCircle, Mail } from 'lucide-react';

const sections = [
  { id: 'what-are-cookies', title: 'What Are Cookies', icon: Cookie },
  { id: 'types-of-cookies', title: 'Types of Cookies', icon: Settings },
  { id: 'how-we-use', title: 'How We Use Cookies', icon: BarChart3 },
  { id: 'third-party', title: 'Third-Party Cookies', icon: Target },
  { id: 'manage-cookies', title: 'Managing Cookies', icon: ToggleLeft },
  { id: 'your-choices', title: 'Your Choices', icon: Shield },
  { id: 'contact', title: 'Contact Us', icon: Mail },
];

const cookieTypes = [
  {
    name: 'Strictly Necessary',
    icon: '🔒',
    color: 'green',
    required: true,
    description: 'Essential for the website to function properly. These cookies enable core functionality such as security, network management, and account access.',
    examples: [
      { name: 'session_id', purpose: 'Maintains your session while browsing', duration: 'Session' },
      { name: 'csrf_token', purpose: 'Protects against cross-site request forgery', duration: 'Session' },
      { name: 'cart_items', purpose: 'Stores items in your shopping cart', duration: '30 days' },
      { name: 'auth_token', purpose: 'Keeps you logged into your account', duration: '7 days' },
    ],
  },
  {
    name: 'Functional',
    icon: '⚙️',
    color: 'blue',
    required: false,
    description: 'Enable enhanced functionality and personalization. These cookies remember your preferences and settings.',
    examples: [
      { name: 'language_pref', purpose: 'Remembers your language preference', duration: '1 year' },
      { name: 'currency', purpose: 'Stores your preferred currency', duration: '1 year' },
      { name: 'recently_viewed', purpose: 'Shows recently viewed products', duration: '30 days' },
      { name: 'theme_mode', purpose: 'Remembers dark/light mode preference', duration: '1 year' },
    ],
  },
  {
    name: 'Analytics',
    icon: '📊',
    color: 'purple',
    required: false,
    description: 'Help us understand how visitors interact with our website by collecting and reporting information anonymously.',
    examples: [
      { name: '_ga', purpose: 'Google Analytics - distinguishes users', duration: '2 years' },
      { name: '_gid', purpose: 'Google Analytics - distinguishes users', duration: '24 hours' },
      { name: '_gat', purpose: 'Google Analytics - throttles request rate', duration: '1 minute' },
      { name: 'hotjar_id', purpose: 'Hotjar - identifies user sessions', duration: '1 year' },
    ],
  },
  {
    name: 'Marketing',
    icon: '📢',
    color: 'orange',
    required: false,
    description: 'Used to track visitors across websites to display relevant and engaging advertisements.',
    examples: [
      { name: '_fbp', purpose: 'Facebook - tracks visits across websites', duration: '3 months' },
      { name: 'ads_session', purpose: 'Google Ads - measures ad effectiveness', duration: '30 days' },
      { name: 'pinterest_sess', purpose: 'Pinterest - enables social sharing', duration: '1 year' },
      { name: 'tiktok_pixel', purpose: 'TikTok - measures ad conversions', duration: '13 months' },
    ],
  },
];

export default function CookiePolicyPage() {
  const lastUpdated = 'March 1, 2026';
  const effectiveDate = 'March 1, 2026';

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
                  <li>• We use cookies to make our website work and improve your experience</li>
                  <li>• Some cookies are essential and cannot be disabled</li>
                  <li>• You can manage non-essential cookies through your browser or our settings</li>
                  <li>• Third-party cookies may be used for analytics and advertising</li>
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
                  <li><strong>Web Beacons:</strong> Small graphic images (also called "pixel tags") used to track user behavior</li>
                  <li><strong>Local Storage:</strong> Data stored in your browser that persists after you close it</li>
                  <li><strong>Session Storage:</strong> Data stored temporarily for a single browser session</li>
                  <li><strong>Fingerprinting:</strong> Collecting device information to create a unique identifier</li>
                </ul>
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Examples:</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">Cookie Name</th>
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
                Some cookies on our website are set by third-party services. These cookies are used for analytics, advertising, and social media integration.
              </p>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                    <h4 className="font-semibold text-gray-900">Google Analytics</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    We use Google Analytics to understand how visitors interact with our website. This helps us improve our content and user experience.
                  </p>
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">
                    View Google's Privacy Policy →
                  </a>
                </div>
                
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">f</div>
                    <h4 className="font-semibold text-gray-900">Facebook Pixel</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    We use Facebook Pixel to measure the effectiveness of our advertising campaigns and to show you relevant ads on Facebook.
                  </p>
                  <a href="https://www.facebook.com/privacy/explanation" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">
                    View Facebook's Privacy Policy →
                  </a>
                </div>
                
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">H</div>
                    <h4 className="font-semibold text-gray-900">Hotjar</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    We use Hotjar to understand user behavior through heatmaps, session recordings, and surveys. This helps us identify usability issues.
                  </p>
                  <a href="https://www.hotjar.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">
                    View Hotjar's Privacy Policy →
                  </a>
                </div>
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
                  Use our Cookie Preferences Center to customize which types of cookies you allow. You can access this at any time by clicking the "Cookie Settings" link in our website footer.
                </p>
                <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">
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
                    <span className="text-xl">📊</span>
                    <div>
                      <h4 className="font-medium text-gray-900">Google Analytics Opt-Out</h4>
                      <p className="text-sm text-gray-600">Install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Google Analytics Opt-Out Browser Add-on</a></p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <span className="text-xl">📢</span>
                    <div>
                      <h4 className="font-medium text-gray-900">Interest-Based Advertising</h4>
                      <p className="text-sm text-gray-600">Visit <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Digital Advertising Alliance</a> or <a href="https://www.youronlinechoices.com/" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Your Online Choices (EU)</a></p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <span className="text-xl">🚫</span>
                    <div>
                      <h4 className="font-medium text-gray-900">Do Not Track</h4>
                      <p className="text-sm text-gray-600">We honor Do Not Track (DNT) signals sent by your browser</p>
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
                    <p><strong>Email:</strong> <a href="mailto:privacy@techtools.com" className="text-orange-600 hover:underline">privacy@techtools.com</a></p>
                    <p><strong>Subject:</strong> Cookie Policy Inquiry</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">General Support</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Email:</strong> <a href="mailto:support@techtools.com" className="text-orange-600 hover:underline">support@techtools.com</a></p>
                    <p><strong>Phone:</strong> +1 (234) 567-890</p>
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
