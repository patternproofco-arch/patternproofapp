import { useState } from 'react'

const highlights = [
  { number: '01', title: 'Walk together', copy: 'A 5K community walk grounded in solidarity, remembrance, and hope.', tone: 'plum' },
  { number: '02', title: 'Find resources', copy: 'Meet local organizations and learn where support can begin—at your pace.', tone: 'blue' },
  { number: '03', title: 'Keep the conversation moving', copy: 'Make room for stories, education, and practical next steps beyond one day.', tone: 'apricot' },
]

const resources = [
  { icon: 'people', label: 'Community', title: 'Connect with local support', copy: 'Explore organizations, advocates, and resource tables gathered for the walk.' },
  { icon: 'heart', label: 'Care', title: 'Bring your whole self', copy: 'Come as you are. Walk, pause, listen, or take the day at the pace that feels right.' },
  { icon: 'spark', label: 'Action', title: 'Leave with a next step', copy: 'Take home information and a clearer sense of where support is available.' },
]

const faqs = [
  { question: 'What time should I arrive?', answer: 'Registration begins at 9:00 AM. The walk begins at 10:00 AM on Thursday, October 1st, 2026.' },
  { question: 'Where does the walk take place?', answer: 'The gathering point is Benjamin Franklin Bridge, Front Street, Philadelphia, PA.' },
  { question: 'What is the Information & Resource Spotlight?', answer: 'It is a community-centered space to learn about support services, advocacy, and organizations working alongside survivors.' },
]

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M16.5 14.5a4.5 4.5 0 0 1 4 4.5" /></>,
    heart: <path d="M20.5 8.5c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5Z" />,
    spark: <><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" /><path d="m19 17 .6 2.4L22 20l-2.4.6L19 23l-.6-2.4L16 20l2.4-.6L19 17Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function EventMark({ light = false }) {
  return (
    <div className={`event-mark ${light ? 'event-mark--light' : ''}`}>
      <span className="ribbon-mark" aria-hidden="true"><i /><i /></span>
      <span className="event-mark-copy"><strong>Survivor</strong><small>Warrior</small></span>
    </div>
  )
}

function App() {
  const [attending, setAttending] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="walk-site">
      <header className="walk-header">
        <a href="#top" className="brand-link" aria-label="Survivor Warrior home"><EventMark /></a>
        <nav className="walk-nav" aria-label="Main navigation">
          <a href="#about">Why we walk</a>
          <a href="#resources">Resources</a>
          <a href="#details">Event details</a>
        </nav>
        <button className="header-cta" onClick={() => scrollTo('join')}>Join the walk <Icon name="arrow" size={16} /></button>
      </header>

      <main id="top">
        <section className="walk-hero">
          <div className="hero-panel">
            <div className="hero-topline"><span className="purple-rule" /> Philly's 3rd Annual <span className="purple-rule" /></div>
            <h1>Domestic Violence<br /><em>Awareness Walk</em></h1>
            <p className="hero-intro">A day to walk in solidarity, connect with resources, and make space for every survivor’s path forward.</p>
            <div className="hero-actions">
              <button className="button button--light" onClick={() => scrollTo('join')}>I’m planning to attend <Icon name="arrow" size={17} /></button>
              <button className="text-link text-link--light" onClick={() => scrollTo('details')}>See event details <Icon name="arrow" size={16} /></button>
            </div>
            <div className="hero-wave" aria-hidden="true"><span /><span /><span /></div>
          </div>
          <div className="poster-panel">
            <div className="poster-frame"><img src="/walk-poster.png" alt="Survivor Warrior Philly's 3rd Annual Domestic Violence Awareness Walk poster" /></div>
            <div className="poster-caption"><span className="caption-dot" /> Bring a friend. Share a resource. Walk with us.</div>
          </div>
        </section>

        <section className="event-bar" id="details" aria-label="Event details">
          <div className="event-detail"><span className="detail-icon"><Icon name="calendar" size={22} /></span><span><small>DATE</small><strong>Thursday, October 1st, 2026</strong></span></div>
          <div className="event-detail"><span className="detail-icon"><Icon name="clock" size={22} /></span><span><small>TIME</small><strong>10:00 AM <em>(registration 9:00 AM)</em></strong></span></div>
          <div className="event-detail"><span className="detail-icon"><Icon name="pin" size={22} /></span><span><small>LOCATION</small><strong>Benjamin Franklin Bridge<br />Front Street, Philadelphia, PA</strong></span></div>
          <div className="event-badge"><span>5K</span><small>Walk with purpose</small></div>
        </section>

        <section className="about-section" id="about">
          <div className="section-label">Why we walk</div>
          <div className="about-grid">
            <div><h2>A clearer record<br /><em>of what changes.</em></h2></div>
            <div className="about-copy"><p>Survivor Warrior is a community walk for awareness, remembrance, and connection. We gather to make domestic violence visible, honor the strength it takes to seek support, and connect people with resources that can help.</p><p>There is no single way to participate. Walk the full 5K, join for the resource spotlight, bring a sign, or simply show up for someone you care about.</p></div>
          </div>
          <div className="highlight-grid">{highlights.map((item) => <article className={`highlight-card highlight-card--${item.tone}`} key={item.number}><span className="highlight-number">{item.number}</span><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
        </section>

        <section className="resource-section" id="resources">
          <div className="resource-heading"><div><div className="section-label">Information & Resource Spotlight</div><h2>Make room for<br /><em>support.</em></h2></div><p>Meet the people and organizations helping build safer, more informed communities across Philadelphia.</p></div>
          <div className="resource-grid">{resources.map((item) => <article className="resource-card" key={item.title}><span className="resource-icon"><Icon name={item.icon} size={25} /></span><span className="resource-label">{item.label}</span><h3>{item.title}</h3><p>{item.copy}</p><button className="card-link" onClick={() => scrollTo('join')}>Keep learning <Icon name="arrow" size={15} /></button></article>)}</div>
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <div><div className="section-label">Before you arrive</div><h2 id="faq-title">A few helpful<br /><em>details.</em></h2><p className="faq-note">Questions are welcome. The walk is designed to be clear, welcoming, and grounded in care.</p></div>
          <div className="faq-list">{faqs.map((faq, index) => <div className={`faq-item ${openFaq === index ? 'is-open' : ''}`} key={faq.question}><button className="faq-question" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{faq.question}</span><span className="faq-icon"><Icon name={openFaq === index ? 'minus' : 'plus'} size={17} /></span></button>{openFaq === index && <p>{faq.answer}</p>}</div>)}</div>
        </section>

        <section className="join-section" id="join">
          <div className="join-card">
            <div className="join-copy"><div className="section-label section-label--light">Ready to walk with us?</div><h2>See you<br /><em>on the bridge.</em></h2><p>Mark the date, invite someone you trust, and come make space for awareness, resources, and community.</p></div>
            <div className="join-action"><button className={`button ${attending ? 'button--confirmed' : 'button--light'}`} onClick={() => setAttending(!attending)}>{attending ? <><Icon name="check" size={17} /> You’re on the list</> : <>I’m planning to attend <Icon name="arrow" size={17} /></>}</button><span>{attending ? 'This is a private demo response—nothing is submitted.' : 'A simple way to hold the date.'}</span></div>
          </div>
        </section>

        <section className="safety-note"><span className="safety-mark"><Icon name="heart" size={18} /></span><p><strong>Take care of yourself.</strong> Participate in the way that feels safest for you. If you need immediate help, contact emergency services or a local domestic-violence advocate.</p></section>
      </main>

      <footer className="walk-footer"><EventMark light /><div className="footer-meta"><span>Survivor Warrior · Philly's 3rd Annual Domestic Violence Awareness Walk</span><span>PatternProof community event</span></div></footer>
    </div>
  )
}

export default App
