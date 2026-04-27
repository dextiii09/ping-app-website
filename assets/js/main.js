document.addEventListener('DOMContentLoaded', () => {

    // 1. Scroll Reveal Animations
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -100px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once revealed to keep it visible
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal').forEach(el => {
        observer.observe(el);
    });

    // 2. Magnetic Buttons Effect
    const magneticElements = document.querySelectorAll('.magnetic');

    magneticElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            // Calculate mouse position relative to element center
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Move the button slightly towards the cursor (strength: 0.3)
            el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        el.addEventListener('mouseleave', () => {
            // Reset position with a spring-like bounce
            el.style.transform = `translate(0px, 0px)`;
        });
    });

    // 3. Trigger initial hero reveal immediately
    setTimeout(() => {
        const hero = document.querySelector('.hero');
        if (hero) hero.classList.add('visible');
    }, 100);
    // 4. Custom Cursor Logic
    const cursor = document.querySelector('.custom-cursor');
    if (cursor) {
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });

        // Add hover effect to interactive elements
        document.querySelectorAll('a, button, .bento-card').forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hovered'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hovered'));
        });
    }

    // 5. Waitlist Modal Logic
    const modal = document.getElementById('waitlistModal');
    const closeBtn = document.querySelector('.modal-close');
    const triggerBtns = document.querySelectorAll('.trigger-modal');
    const form = document.getElementById('waitlistForm');
    const successMsg = document.getElementById('successMessage');

    if (modal) {
        // Open modal
        triggerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('active');
            });
        });

        // Close modal (X button)
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                form.style.display = 'flex';
                successMsg.style.display = 'none';
                form.reset();
            }, 400); // Reset form after transition
        });

        // Close modal (Click outside)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // Handle Form Submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            // Simulate API call
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Securing...';
            
            setTimeout(() => {
                form.style.display = 'none';
                successMsg.style.display = 'block';
                submitBtn.textContent = 'Secure My Spot';
            }, 1000);
        });
    }

});
