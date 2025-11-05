import Hero from '../sections/Hero.jsx';
import Gallery from '../sections/Gallery.jsx';
import Services from '../sections/Services.jsx';
import About from '../sections/About.jsx';
import Testimonials from '../sections/Testimonials.jsx';
import Booking from '../sections/Booking.jsx';
import FAQ from '../sections/FAQ.jsx';
import Contact from '../sections/Contact.jsx';

export default function Landing() {
  return (
    <main className="space-y-24">
      <Hero />
      <Gallery />
      <Services />
      <About />
      <Testimonials />
      <Booking />
      <FAQ />
      <Contact />
    </main>
  );
}
