document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Intersection Observer for staggered cinematic fade-ins
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0) translateZ(0)";
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply to elements
    const animateElements = document.querySelectorAll('.feature-card, .premium-container, .section-header');
    animateElements.forEach((el, index) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(40px)";
        // Stagger the transition based on the element's position
        el.style.transition = `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;
        observer.observe(el);
    });

    // 3D Mouse Tracking Tilt Effect for Feature Cards
    const cards = document.querySelectorAll('.feature-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);
    });

    function handleMouseMove(e) {
        const card = this;
        const rect = card.getBoundingClientRect();
        
        // Calculate mouse position relative to card center (-1 to 1)
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -10; // Max 10 deg tilt
        const rotateY = ((x - centerX) / centerX) * 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        card.style.transition = 'transform 0.1s ease-out';
        
        // Dynamic border glow effect following mouse
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    }

    function handleMouseLeave(e) {
        const card = this;
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
});
