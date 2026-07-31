// ============================================
// Terms of Service Page - Production Ready
// ============================================

import { Link } from 'react-router-dom';
import { FileText, ShoppingCart, CreditCard, Truck, RotateCcw, AlertTriangle, Scale, Mail } from 'lucide-react';

const sections = [
  { id: 'acceptance', title: 'Acceptance of Terms', icon: FileText },
  { id: 'account', title: 'Account Terms', icon: FileText },
  { id: 'orders', title: 'Orders & Payment', icon: ShoppingCart },
  { id: 'shipping', title: 'Shipping & Delivery', icon: Truck },
  { id: 'returns', title: 'Returns & Refunds', icon: RotateCcw },
  { id: 'prohibited', title: 'Prohibited Uses', icon: AlertTriangle },
  { id: 'liability', title: 'Limitation of Liability', icon: Scale },
  { id: 'contact', title: 'Contact Us', icon: Mail },
];

export default function TermsOfServicePage() {
  const lastUpdated = 'March 1, 2026';
  const effectiveDate = 'March 1, 2026';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Please read these terms carefully before using our services. By accessing or using TechTools, you agree to be bound by these terms.
            </p>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
              <span>Last Updated: {lastUpdated}</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" />
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
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors shrink-0"
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
          {/* Introduction */}
          <div className="bg-white rounded-2xl p-8 shadow-sm mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Introduction</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 leading-relaxed">
                Welcome to TechTools. These Terms of Service ("Terms") govern your access to and use of the TechTools website, mobile applications, and services (collectively, the "Services") operated by TechTools Inc. ("we," "us," or "our").
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Services.
              </p>
            </div>
          </div>

          {/* Section 1: Acceptance of Terms */}
          <section id="acceptance" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">1. Acceptance of Terms</h2>
            </div>
            
            <div className="space-y-4 text-gray-600">
              <p>
                By creating an account, making a purchase, or otherwise using our Services, you confirm that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are at least 18 years of age or the age of majority in your jurisdiction</li>
                <li>You have the legal capacity to enter into a binding agreement</li>
                <li>You will use our Services in compliance with these Terms and all applicable laws</li>
                <li>All information you provide is accurate, current, and complete</li>
              </ul>
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to our website. Your continued use of the Services after any changes constitutes acceptance of the new Terms.
              </p>
            </div>
          </section>

          {/* Section 2: Account Terms */}
          <section id="account" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">2. Account Terms</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Account Creation</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>You must provide accurate and complete information when creating an account</li>
                  <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                  <li>You must notify us immediately of any unauthorized access to your account</li>
                  <li>One person or entity may not maintain more than one account</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Account Security</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>Use a strong, unique password for your account</li>
                  <li>Do not share your account credentials with third parties</li>
                  <li>We are not liable for any loss resulting from unauthorized use of your account</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Account Termination</h3>
                <p className="text-gray-600">
                  We reserve the right to suspend or terminate your account at any time, with or without notice, for any reason, including but not limited to violation of these Terms, suspected fraudulent activity, or extended periods of inactivity.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Orders & Payment */}
          <section id="orders" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">3. Orders & Payment</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing & Availability</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>All prices are displayed in EUR unless otherwise specified</li>
                  <li>Prices are subject to change without notice</li>
                  <li>We reserve the right to limit quantities of any products</li>
                  <li>Product availability is subject to change and not guaranteed</li>
                  <li>In case of pricing errors, we reserve the right to cancel orders</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Acceptance</h3>
                <p className="text-gray-600 mb-3">
                  Your order placement is an offer to purchase. We reserve the right to accept or decline your order for any reason, including:
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Product unavailability</li>
                  <li>Pricing or product description errors</li>
                  <li>Suspected fraudulent activity</li>
                  <li>Quantity limitations</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Terms</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                      <h4 className="font-semibold text-gray-900">Accepted Methods</h4>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Credit/Debit Cards (Visa, Mastercard, Amex)</li>
                      <li>• PayPal</li>
                      <li>• Apple Pay / Google Pay</li>
                      <li>• Bank Transfer (select regions)</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Payment Processing</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Payment is processed upon order confirmation</li>
                      <li>• All transactions are securely encrypted</li>
                      <li>• We use PCI-DSS compliant payment processors</li>
                      <li>• Additional verification may be required</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> You agree that all information provided for payment is accurate and that you are authorized to use the payment method. Fraudulent transactions will be reported to law enforcement.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Shipping & Delivery */}
          <section id="shipping" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">4. Shipping & Delivery</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Shipping Options</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-3 rounded-tl-lg font-semibold">Method</th>
                        <th className="text-left p-3 font-semibold">Estimated Delivery</th>
                        <th className="text-left p-3 rounded-tr-lg font-semibold">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="p-3 font-medium">Standard Shipping</td>
                        <td className="p-3 text-gray-600">5-7 business days</td>
                        <td className="p-3 text-gray-600">Free over €50 / €4.99</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Express Shipping</td>
                        <td className="p-3 text-gray-600">2-3 business days</td>
                        <td className="p-3 text-gray-600">€9.99</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Next Day Delivery</td>
                        <td className="p-3 text-gray-600">1 business day</td>
                        <td className="p-3 text-gray-600">€14.99</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Terms</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Delivery times are estimates and not guaranteed</li>
                  <li>Risk of loss passes to you upon delivery to the carrier</li>
                  <li>You are responsible for providing accurate shipping information</li>
                  <li>Additional charges may apply for remote areas or international shipping</li>
                  <li>Signature may be required for high-value orders</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">International Shipping</h3>
                <p className="text-gray-600">
                  For international orders, you are responsible for all customs duties, taxes, and import fees. We are not responsible for delays caused by customs processing.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Returns & Refunds */}
          <section id="returns" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">5. Returns & Refunds</h2>
            </div>
            
            <div className="space-y-6">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-teal-800 font-medium">
                  We offer a 30-day return policy on most items. See below for complete details.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Return Eligibility</h3>
                <p className="text-gray-600 mb-3">To be eligible for a return, items must:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Be returned within 30 days of delivery</li>
                  <li>Be unused and in original condition</li>
                  <li>Include all original packaging and accessories</li>
                  <li>Have proof of purchase (order number or receipt)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Non-Returnable Items</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Items marked as "Final Sale" or "Non-Returnable"</li>
                  <li>Personalized or customized products</li>
                  <li>Products with broken seals (for hygiene/safety reasons)</li>
                  <li>Downloadable software or digital products</li>
                  <li>Gift cards</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Refund Process</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold">1</div>
                    <h4 className="font-semibold text-gray-900 mb-1">Request Return</h4>
                    <p className="text-sm text-gray-600">Contact us or use your account dashboard</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold">2</div>
                    <h4 className="font-semibold text-gray-900 mb-1">Ship Item Back</h4>
                    <p className="text-sm text-gray-600">Use the prepaid label we provide</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold">3</div>
                    <h4 className="font-semibold text-gray-900 mb-1">Receive Refund</h4>
                    <p className="text-sm text-gray-600">Within 5-10 business days of receipt</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Refund Methods</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                  <li>Refunds are issued to the original payment method</li>
                  <li>Store credit may be offered as an alternative</li>
                  <li>Original shipping costs are non-refundable (unless item was defective)</li>
                  <li>Return shipping is free for defective items</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6: Prohibited Uses */}
          <section id="prohibited" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">6. Prohibited Uses</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                You agree not to use our Services for any unlawful purpose or in any way that could damage, disable, or impair our Services. Prohibited activities include but are not limited to:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Fraudulent Activities</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Using stolen payment information</li>
                    <li>• Creating fake accounts</li>
                    <li>• Filing false disputes or chargebacks</li>
                    <li>• Misrepresenting identity</li>
                  </ul>
                </div>
                
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Technical Abuse</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Attempting to hack or breach security</li>
                    <li>• Introducing malware or viruses</li>
                    <li>• Scraping or data mining</li>
                    <li>• Interfering with server functionality</li>
                  </ul>
                </div>
                
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Commercial Misuse</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Reselling products without authorization</li>
                    <li>• Using our content without permission</li>
                    <li>• Competing unfairly with our business</li>
                    <li>• Bulk purchasing for resale</li>
                  </ul>
                </div>
                
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Harmful Content</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Posting offensive or illegal content</li>
                    <li>• Harassing other users</li>
                    <li>• Submitting fraudulent reviews</li>
                    <li>• Spamming or phishing</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-red-100 border border-red-200 rounded-xl p-4 mt-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> Violation of these terms may result in immediate account termination, legal action, and reporting to law enforcement authorities.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7: Limitation of Liability */}
          <section id="liability" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Scale className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">7. Limitation of Liability</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Disclaimer of Warranties</h3>
                <p className="text-gray-600">
                  OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Limitation of Damages</h3>
                <p className="text-gray-600">
                  TO THE FULLEST EXTENT PERMITTED BY LAW, TECHTOOLS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF OUR SERVICES.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Maximum Liability</h3>
                <p className="text-gray-600">
                  In no event shall our total liability to you for all claims arising from or related to your use of our Services exceed the amount you paid to us in the twelve (12) months preceding the claim.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Indemnification</h3>
                <p className="text-gray-600">
                  You agree to indemnify, defend, and hold harmless TechTools and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from your use of our Services or violation of these Terms.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: General Provisions */}
          <section className="bg-white rounded-2xl p-8 shadow-sm mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">8. General Provisions</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Governing Law</h3>
                <p className="text-gray-600">
                  These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Dispute Resolution</h3>
                <p className="text-gray-600">
                  Any disputes arising from these Terms or your use of our Services shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration in San Francisco, California, in accordance with the rules of the American Arbitration Association.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Severability</h3>
                <p className="text-gray-600">
                  If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Entire Agreement</h3>
                <p className="text-gray-600">
                  These Terms, together with our Privacy Policy and any other agreements referenced herein, constitute the entire agreement between you and TechTools regarding your use of our Services.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Waiver</h3>
                <p className="text-gray-600">
                  Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9: Contact */}
          <section id="contact" className="bg-white rounded-2xl p-8 shadow-sm mb-8 scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">9. Contact Us</h2>
            </div>
            
            <div className="space-y-6">
              <p className="text-gray-600">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Legal Inquiries</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Email:</strong> <a href="mailto:legal@techtools.com" className="text-orange-600 hover:underline">legal@techtools.com</a></p>
                    <p><strong>Subject:</strong> Terms of Service Inquiry</p>
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
              
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-3">Mailing Address</h4>
                <p className="text-gray-600">
                  TechTools Inc.<br />
                  Attn: Legal Department<br />
                  123 Tech Street<br />
                  San Francisco, CA 94102<br />
                  United States
                </p>
              </div>
            </div>
          </section>

          {/* Related Links */}
          <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 shadow-sm mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Related Policies</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link 
                to="/privacy" 
                className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <span className="font-medium text-gray-900">Privacy Policy</span>
              </Link>
              
              <Link 
                to="/cookies" 
                className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <span className="font-medium text-gray-900">Cookie Policy</span>
              </Link>
              
              <Link 
                to="/returns" 
                className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-teal-600" />
                </div>
                <span className="font-medium text-gray-900">Returns Policy</span>
              </Link>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Have questions about our terms?
            </p>
            <Link 
              to="/contact" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Our Legal Team
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
