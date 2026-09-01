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

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const formData = new FormData(form);
            if (formData.get('pdnConsent') !== 'on') {
                if (status) status.textContent = 'Сначала подтвердите отдельное согласие на обработку данных.';
                return;
            }

            const consentTime = new Date().toISOString();
            const subject = 'Заявка с сайта DIGRIX';
            const body = [
                'Имя: ' + String(formData.get('name') || '').trim(),
                'Контакт: ' + String(formData.get('contact') || '').trim(),
                '',
                'Задача:',
                String(formData.get('message') || '').trim(),
                '',
                'Согласие на обработку персональных данных: предоставлено.',
                'Редакция согласия: 2026-09-01.',
                'Время формирования письма: ' + consentTime
            ].join('\n');

            if (status) {
                status.textContent = 'Открываем почтовое приложение. Данные будут переданы только после отправки письма.';
            }

            window.location.href = 'mailto:ilhamzakir@mail.ru?subject=' +
                encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
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
