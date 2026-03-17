import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Shield, FileText, AlertTriangle, ChevronRight } from "lucide-react";

const LAST_UPDATED = "March 11, 2026";

type LegalSection = "terms" | "privacy" | "disclaimers" | "vendor-eligibility";

const SECTIONS: { id: LegalSection; label: string; icon: typeof Shield }[] = [
  { id: "terms", label: "Terms of Service", icon: FileText },
  { id: "privacy", label: "Privacy Policy", icon: Shield },
  { id: "vendor-eligibility", label: "Vendor Eligibility Policy", icon: Shield },
  { id: "disclaimers", label: "Disclaimers", icon: AlertTriangle },
];

function isValidSection(value: string | null): value is LegalSection {
  return value !== null && SECTIONS.some((s) => s.id === value);
}

export default function Legal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSection = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<LegalSection>(
    isValidSection(rawSection) ? rawSection : "terms"
  );

  useEffect(() => {
    const section = searchParams.get("section");
    setActiveSection(isValidSection(section) ? section : "terms");
  }, [searchParams]);

  const handleSectionChange = (section: LegalSection) => {
    setActiveSection(section);
    setSearchParams({ section });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-[#0a4a82]/95 to-[#0a4a82]/80 backdrop-blur-md border-b border-white/10">
        <div className="container py-12 md:py-16">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
            <Link to="/" className="hover:text-white transition-colors" data-testid="link-home-breadcrumb">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Legal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight" data-testid="text-legal-title">
            Legal Information
          </h1>
          <p className="text-white/70 mt-2 max-w-2xl">
            Please review our terms, policies, and disclaimers. By using Local List 365, you agree to the terms outlined below.
          </p>
        </div>
      </div>

      <div className="container py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0">
            <nav className="lg:sticky lg:top-24 space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    data-testid={`button-legal-${section.id}`}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all text-sm font-medium ${
                      isActive
                        ? "bg-[#0a4a82] text-white shadow-lg shadow-[#0a4a82]/25"
                        : "bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md border border-gray-200/60"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
              <div className="p-6 md:p-10">
                {activeSection === "terms" && <TermsOfService />}
                {activeSection === "privacy" && <PrivacyPolicy />}
                {activeSection === "vendor-eligibility" && <VendorEligibilityPolicy />}
                {activeSection === "disclaimers" && <Disclaimers />}
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-white/60">
              <p>Last updated: {LAST_UPDATED}</p>
              <p className="mt-1">
                Questions? Contact us at{" "}
                <a href="mailto:legal@locallist365.com" className="text-[#d4a373] hover:underline" data-testid="link-legal-email">
                  legal@locallist365.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof Shield; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
      <div className="p-2 bg-[#0a4a82]/10 rounded-lg">
        <Icon className="w-5 h-5 text-[#0a4a82]" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900" style={{ color: "#1a1a2e" }}>{title}</h2>
    </div>
  );
}

function SubSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-3" style={{ color: "#1a1a2e" }}>
        {number}. {title}
      </h3>
      <div className="text-gray-600 leading-relaxed space-y-3 text-[15px]" style={{ color: "#374151" }}>
        {children}
      </div>
    </div>
  );
}

function TermsOfService() {
  return (
    <div>
      <SectionHeading icon={FileText} title="Terms of Service" />
      <p className="text-gray-600 mb-8 text-[15px] leading-relaxed" style={{ color: "#374151" }}>
        Welcome to Local List 365. These Terms of Service ("Terms") govern your access to and use of the Local List 365 website, applications, and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.
      </p>

      <SubSection number="1" title="Acceptance of Terms">
        <p>By creating an account, browsing listings, submitting reviews, requesting quotes, or otherwise using Local List 365, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.</p>
      </SubSection>

      <SubSection number="2" title="Eligibility">
        <p>You must be at least 18 years of age to use Local List 365. By using the Service, you represent and warrant that you meet this requirement and that all registration information you provide is truthful and accurate.</p>
      </SubSection>

      <SubSection number="3" title="User Accounts">
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify Local List 365 immediately of any unauthorized use of your account. Local List 365 reserves the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.</p>
      </SubSection>

      <SubSection number="4" title="Business Listings and Membership">
        <p>Businesses may create listings on Local List 365 and subscribe to membership tiers (Bronze, Silver, or Gold) for enhanced features and visibility. Membership fees, features, and billing terms are described on the Membership page. All membership subscriptions are managed through Stripe and are subject to Stripe's terms of service. Memberships may be canceled at any time through the billing portal; cancellations take effect at the end of the current billing period.</p>
        <p className="mt-2"><strong>Eligibility:</strong> All business listings are subject to our <a href="/legal?section=vendor-eligibility" className="text-[#0a4a82] hover:underline font-semibold">Local Vendor Eligibility Policy</a>. Only independently owned and locally operated businesses serving Currituck County are eligible for listing. National chains, franchises, and corporate-controlled operations are not permitted. All listings are reviewed and approved at the sole discretion of directory administrators.</p>
      </SubSection>

      <SubSection number="5" title="User-Generated Content">
        <p>You retain ownership of content you submit to Local List 365, including reviews, business descriptions, photos, and other materials ("User Content"). By submitting User Content, you grant Local List 365 a non-exclusive, royalty-free, worldwide license to use, display, reproduce, and distribute such content in connection with the Service. You represent that you have all necessary rights to grant this license and that your content does not violate any third-party rights or applicable laws.</p>
      </SubSection>

      <SubSection number="6" title="Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Submit false, misleading, or fraudulent information</li>
          <li>Post defamatory, harassing, threatening, or discriminatory content</li>
          <li>Impersonate any person or entity</li>
          <li>Manipulate ratings, reviews, or search results</li>
          <li>Use automated systems to scrape or collect data from the Service</li>
          <li>Interfere with the operation or security of the Service</li>
          <li>Violate any applicable local, state, or federal law</li>
        </ul>
      </SubSection>

      <SubSection number="7" title="Quote and Bid System">
        <p>Local List 365 provides a platform for customers to request quotes from businesses. Local List 365 does not participate in, mediate, or guarantee any transaction between customers and businesses. Any agreement, contract, or arrangement entered into between a customer and a business is solely between those parties. Local List 365 bears no responsibility for the quality, safety, legality, or completion of any work resulting from the quote system.</p>
      </SubSection>

      <SubSection number="8" title="Advertising">
        <p>Businesses may purchase advertising space on Local List 365. All advertising content must comply with these Terms, applicable laws, and our advertising guidelines. Local List 365 reserves the right to reject or remove any advertisement at its sole discretion. Advertising fees are non-refundable once the ad has been published and is live on the platform.</p>
      </SubSection>

      <SubSection number="9" title="Intellectual Property">
        <p>All content, design, trademarks, logos, and software comprising the Service are the property of Local List 365 or its licensors and are protected by applicable intellectual property laws. You may not reproduce, modify, distribute, or create derivative works from any part of the Service without prior written consent.</p>
      </SubSection>

      <SubSection number="10" title="Termination">
        <p>Local List 365 may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service ceases immediately. Sections of these Terms that by their nature should survive termination will remain in effect.</p>
      </SubSection>

      <SubSection number="11" title="Non-Discrimination and Code of Conduct">
        <p>Local List 365 adheres to a zero-tolerance policy against discrimination. We reserve the right to remove users or businesses that violate this policy or our code of conduct, which requires honesty, respect, and compliance with all applicable laws.</p>
      </SubSection>

      <SubSection number="12" title="Changes to Terms">
        <p>Local List 365 reserves the right to modify these Terms at any time. Material changes will be communicated through the Service or via email. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms.</p>
      </SubSection>

      <SubSection number="13" title="Governing Law">
        <p>These Terms are governed by and construed in accordance with the laws of the State of North Carolina, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Currituck County, North Carolina.</p>
      </SubSection>

      <SubSection number="14" title="Contact">
        <p>For questions about these Terms, please contact us at <a href="mailto:legal@locallist365.com" className="text-[#0a4a82] hover:underline font-medium">legal@locallist365.com</a>.</p>
      </SubSection>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div>
      <SectionHeading icon={Shield} title="Privacy Policy" />
      <p className="text-gray-600 mb-8 text-[15px] leading-relaxed" style={{ color: "#374151" }}>
        Local List 365 ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
      </p>

      <SubSection number="1" title="Information We Collect">
        <p><strong>Account Information:</strong> When you create an account, we collect your name, email address, password (stored in hashed form), and account type (customer or business).</p>
        <p><strong>Business Information:</strong> Business owners may provide business name, description, address, phone number, category, photos, credentials, and other listing details.</p>
        <p><strong>Usage Data:</strong> We automatically collect information about your interactions with the Service, including IP address, browser type, pages visited, and access times.</p>
        <p><strong>Location Data:</strong> With your consent, we may collect approximate location data to provide location-based search and directory features.</p>
        <p><strong>Payment Information:</strong> Payment processing is handled by Stripe. We do not store your credit card numbers or banking information on our servers.</p>
      </SubSection>

      <SubSection number="2" title="How We Use Your Information">
        <p>We use collected information to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Provide, maintain, and improve the Service</li>
          <li>Process transactions and manage memberships</li>
          <li>Facilitate the quote request and bidding system</li>
          <li>Display business listings and reviews</li>
          <li>Send administrative communications and service updates</li>
          <li>Detect and prevent fraud, abuse, and security incidents</li>
          <li>Comply with legal obligations</li>
        </ul>
      </SubSection>

      <SubSection number="3" title="Information Sharing">
        <p>We do not sell your personal information. We may share information with:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>Service Providers:</strong> Third parties that assist in operating the Service (e.g., Stripe for payments, hosting providers)</li>
          <li><strong>Business Interactions:</strong> When you submit a quote request, relevant details are shared with the businesses you contact</li>
          <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
          <li><strong>Safety:</strong> To protect the rights, property, or safety of Local List 365, our users, or others</li>
        </ul>
      </SubSection>

      <SubSection number="4" title="Cookies and Tracking">
        <p>We use cookies and similar technologies to maintain your session, remember preferences, and analyze usage patterns. You may adjust your browser settings to refuse cookies, though some features of the Service may not function properly without them.</p>
      </SubSection>

      <SubSection number="5" title="Data Security">
        <p>We implement industry-standard security measures to protect your information, including encrypted passwords (bcrypt hashing), secure session management, and HTTPS encryption. However, no method of transmission over the Internet is completely secure, and we cannot guarantee absolute security.</p>
      </SubSection>

      <SubSection number="6" title="Data Retention">
        <p>We retain your information for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data by contacting us. Certain information may be retained as required by law or for legitimate business purposes.</p>
      </SubSection>

      <SubSection number="7" title="Your Rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your information</li>
          <li>Object to or restrict certain processing activities</li>
          <li>Withdraw consent where processing is based on consent</li>
        </ul>
        <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@locallist365.com" className="text-[#0a4a82] hover:underline font-medium">privacy@locallist365.com</a>.</p>
      </SubSection>

      <SubSection number="8" title="Third-Party Links">
        <p>Local List 365 may contain links to third-party websites. We are not responsible for the content, privacy practices, or availability of these external sites. We encourage you to review the privacy policies of any third-party sites you visit.</p>
      </SubSection>

      <SubSection number="9" title="Children's Privacy">
        <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information.</p>
      </SubSection>

      <SubSection number="10" title="Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Service with a revised "Last Updated" date. Continued use of the Service after changes are posted constitutes acceptance of the revised policy.</p>
      </SubSection>

      <SubSection number="11" title="Contact">
        <p>For questions or concerns about this Privacy Policy, contact us at <a href="mailto:privacy@locallist365.com" className="text-[#0a4a82] hover:underline font-medium">privacy@locallist365.com</a>.</p>
      </SubSection>
    </div>
  );
}

function VendorEligibilityPolicy() {
  return (
    <div>
      <SectionHeading icon={Shield} title="Local Vendor Eligibility Policy" />
      <p className="text-gray-600 mb-6 text-[15px] leading-relaxed" style={{ color: "#374151" }}>
        This directory celebrates and promotes independently owned and operated local businesses based in and primarily serving Currituck County, North Carolina — including mainland areas, Knotts Island, and northern Outer Banks communities like Corolla, Moyock, Grandy, Barco, Shawboro, and beyond.
      </p>

      <SubSection number="1" title="Who We Welcome">
        <p>We welcome vendors who:</p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li><strong>Are owned and operated by local Currituck County residents</strong> or individuals primarily serving our community.</li>
          <li><strong>Run their businesses independently,</strong> with personal control over operations, customer relationships, and sales.</li>
          <li><strong>May sell products from national brands</strong> through direct sales or independent consultant models, as long as the business itself is locally driven and not part of a corporate chain, franchise system, or multi-level network requiring ongoing royalties or centralized control.</li>
        </ul>
      </SubSection>

      <SubSection number="2" title="What We Do Not Include">
        <p>The following types of businesses are <strong>not eligible</strong> for listing:</p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>National or regional corporate chains and fully company-owned operations.</li>
          <li>Franchise locations or businesses operating under national franchise agreements.</li>
          <li>Any operation where major branding, decision-making, or control is held outside Currituck County by a distant corporate entity.</li>
        </ul>
      </SubSection>

      <SubSection number="3" title="Review and Approval">
        <p>All listings are reviewed and approved at the sole discretion of the directory administrators to align with our mission: <strong>boosting Currituck County's homegrown economy</strong> by highlighting truly local entrepreneurs, artisans, service providers, and independent sellers who contribute directly to our community.</p>
      </SubSection>

      <SubSection number="4" title="Submission Process">
        <p>Applicants should provide basic details confirming local operation and independence (e.g., home-based in Currituck, no franchise agreement). As part of the business registration form, applicants are required to describe how their business is independently owned and locally operated. We may ask for simple verification to ensure fit.</p>
        <p className="mt-2">For independent consultants or direct sellers (e.g., Mary Kay, Pampered Chef), please describe how your business is personally run and community-focused — for example, home-based sales, personal customer relationships, or local event participation.</p>
      </SubSection>

      <SubSection number="5" title="Our Mission">
        <p>This policy reflects our core values: supporting Currituck County's local economy by connecting residents and visitors with <strong>truly local, independently operated businesses</strong>. We believe that when you shop local, you invest in your neighbors, your community, and the unique character of Currituck County.</p>
      </SubSection>
    </div>
  );
}

function Disclaimers() {
  return (
    <div>
      <SectionHeading icon={AlertTriangle} title="Disclaimers" />
      <p className="text-gray-600 mb-8 text-[15px] leading-relaxed" style={{ color: "#374151" }}>
        The following disclaimers apply to your use of Local List 365 and all services provided through the platform.
      </p>

      <SubSection number="1" title="General Disclaimer on Endorsements and Business Information">
        <p>Local List 365 does not represent, endorse, or guarantee the accuracy, completeness, or reliability of any business, service provider, or information listed on the website. All business profiles, descriptions, and related information are provided directly by the business owners or authorized representatives. Local List 365 acts solely as a platform for user-generated content and does not verify, screen, or approve such information. Users are encouraged to conduct their own due diligence before engaging with any listed business.</p>
      </SubSection>

      <SubSection number="2" title="Reviews and Ratings Disclaimer">
        <p>Local List 365 does not pull reviews or ratings from any external websites or sources. All reviews and ratings displayed on Local List 365 are submitted and verified directly through our platform by verified users. These reviews reflect the personal opinions and experiences of individual users and do not represent the views, opinions, or endorsements of Local List 365, its affiliates, employees, or partners. Local List 365 disclaims any and all representations or warranties regarding the accuracy or fairness of reviews and assumes no responsibility or liability for any claims, damages, or losses arising from the use of or reliance on any reviews or ratings.</p>
      </SubSection>

      <SubSection number="3" title="&quot;As Is&quot; and No Warranty Disclaimer">
        <p>The Local List 365 website and services are provided on an "as is" and "as available" basis without any warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. Local List 365 makes no representations or warranties about the suitability, reliability, availability, timeliness, or accuracy of the information, services, or related graphics contained on the site for any purpose. You acknowledge that Local List 365 has no control over, and no duty to take action regarding, the content submitted by users or businesses, or the actions users may take based on such content.</p>
      </SubSection>

      <SubSection number="4" title="Limitation of Liability">
        <p>To the fullest extent permitted by law, Local List 365, its affiliates, officers, directors, employees, and agents shall not be liable for any direct, indirect, incidental, special, punitive, compensatory, consequential, or exemplary damages (even if advised of the possibility of such damages) arising from or related to your use of the website, including but not limited to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Any interactions with service providers</li>
          <li>Reliance on business information or reviews</li>
          <li>Errors, omissions, or inaccuracies in content</li>
          <li>Any viruses, interruptions, or other technical issues</li>
        </ul>
        <p className="mt-2">This limitation applies whether the alleged liability is based on contract, tort, negligence, strict liability, or any other basis.</p>
      </SubSection>

      <SubSection number="5" title="User-Generated Content and Release of Claims">
        <p>You agree that all content on Local List 365, including business profiles and reviews, is user-generated or provided by third parties. By using the site, you waive any right to bring or assert claims against Local List 365 relating to such content and release Local List 365 from any and all liability for or relating to any content, including service provider content. Local List 365 reserves the right, but has no obligation, to monitor, edit, or remove content that violates our terms.</p>
      </SubSection>

      <SubSection number="6" title="Third-Party Links">
        <p>Local List 365 may contain links to third-party websites or services that are not owned or controlled by Local List 365. We are not responsible for the content, privacy practices, or availability of these external sites. The inclusion of any link does not imply endorsement by Local List 365. You access third-party sites at your own risk.</p>
      </SubSection>

      <SubSection number="7" title="AI Chatbot Disclaimer">
        <p>Local List 365 provides an AI-powered chatbot assistant ("Ziggy") for informational purposes only. Responses generated by Ziggy are based on available data and may not always be accurate, complete, or current. Ziggy's responses do not constitute professional advice of any kind. Users should independently verify any information provided by the chatbot before making decisions based on it.</p>
      </SubSection>
    </div>
  );
}
