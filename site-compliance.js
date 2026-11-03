(function () {
    'use strict';

    const NOTICE_KEY = 'digrix_cookie_notice_v1';
    const NOTICE_VERSION = '2026-09-01';
    const NOTICE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
    let lastFocusedElement = null;

    function hasCurrentNotice() {
        try {
            const saved = JSON.parse(localStorage.getItem(NOTICE_KEY));
            return Boolean(
                saved &&
                saved.version === NOTICE_VERSION &&
                Number(saved.expiresAt) > Date.now()
            );
        } catch (error) {
            return false;
        }
    }

    function saveNotice() {
        try {
            localStorage.setItem(NOTICE_KEY, JSON.stringify({
                version: NOTICE_VERSION,
                acknowledgedAt: new Date().toISOString(),
                expiresAt: Date.now() + NOTICE_LIFETIME_MS
            }));
        } catch (error) {
            // Если локальное хранилище недоступно, выбор действует до обновления страницы.
        }
    }

    function setPageInteractive(dialog, interactive) {
        Array.from(document.body.children).forEach(function (element) {
            if (element !== dialog && element.tagName !== 'SCRIPT') {
                element.inert = !interactive;
            }
        });
    }

    function showNotice(dialog) {
        lastFocusedElement = document.activeElement;
        dialog.hidden = false;
        document.body.classList.add('privacy-gate-open');
        setPageInteractive(dialog, false);

        const continueButton = document.getElementById('privacy-gate-continue');
        if (continueButton) continueButton.focus();
    }

    function hideNotice(dialog) {
        dialog.hidden = true;
        document.body.classList.remove('privacy-gate-open');
        setPageInteractive(dialog, true);

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    function initNotice() {
        const dialog = document.getElementById('privacy-gate');
        const continueButton = document.getElementById('privacy-gate-continue');
        if (!dialog || !continueButton) return;

        continueButton.addEventListener('click', function () {
            saveNotice();
            hideNotice(dialog);
        });

        document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
            button.addEventListener('click', function () {
                showNotice(dialog);
            });
        });

        if (hasCurrentNotice()) {
            hideNotice(dialog);
        } else {
            showNotice(dialog);
        }
    }

    function initContactForm() {
        const form = document.getElementById('contact-form');
        const status = document.getElementById('contact-form-status');
        if (!form) return;

        // GitHub Pages is static: the form keeps the original mailto fallback
        // until a private, correctly hosted contact API has been configured.
        const endpoint = (form.getAttribute('data-endpoint') || '').trim();
        const button = form.querySelector('button[type="submit"]');
        const note = form.querySelector('.contact-form__note');

        if (endpoint) {
            if (button) button.textContent = 'Отправить заявку →';
            if (note) note.textContent = 'Отправляя форму, вы соглашаетесь на обработку данных согласно документам сайта.';
        }

        function prepareMailto(payload) {
            const subject = 'Заявка с сайта DIGRIX';
            const body = [
                'Имя: ' + payload.name,
                'Контакт: ' + payload.contact,
                '',
                'Задача:',
                payload.message,
                '',
                'Согласие на обработку персональных данных: предоставлено.',
                'Редакция согласия: 2026-09-01.',
                'Время формирования письма: ' + payload.consentAt
            ].join('\n');

            if (status) status.textContent = 'Открываем почтовое приложение. Данные будут переданы только после отправки письма.';
            window.location.href = 'mailto:ilhamzakir@mail.ru?subject=' +
                encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const formData = new FormData(form);
            if (formData.get('pdnConsent') !== 'on') {
                if (status) status.textContent = 'Сначала подтвердите отдельное согласие на обработку данных.';
                return;
            }

            const payload = {
                name: String(formData.get('name') || '').trim(),
                contact: String(formData.get('contact') || '').trim(),
                message: String(formData.get('message') || '').trim(),
                website: String(formData.get('website') || ''),
                consent: true,
                consentVersion: '2026-09-01',
                consentAt: new Date().toISOString()
            };

            if (!payload.name || !payload.contact || !payload.message) {
                if (status) status.textContent = 'Заполните все обязательные поля.';
                return;
            }

            if (!endpoint) {
                prepareMailto(payload);
                return;
            }

            if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://localhost:')) {
                if (status) status.textContent = 'Ошибка настройки формы. Свяжитесь с нами по телефону или email.';
                return;
            }

            if (button) button.disabled = true;
            if (status) status.textContent = 'Отправляем заявку…';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer'
                });
                if (!response.ok) throw new Error('Contact request failed');
                if (status) status.textContent = 'Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному контакту.';
                form.reset();
            } catch (error) {
                // A timeout does not prove that the server didn't receive the request.
                // Avoid automatic retries that could create duplicate leads.
                if (status) status.textContent = 'Не удалось подтвердить отправку. Пожалуйста, позвоните или напишите нам на email.';
            } finally {
                clearTimeout(timeout);
                if (button) button.disabled = false;
            }
        });
    }

    function init() {
        initNotice();
        initContactForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
