// Runs in TikTok's page so the profile Actions menu and Block dialog receive real React handlers.
(function () {
    'use strict';
    if (window.__tiktokAutoBlockerPageClick) return;
    window.__tiktokAutoBlockerPageClick = true;

    function reactProps(element) {
        var node = element;
        var guard = 0;
        while (node && guard < 6) {
            var key = Object.keys(node).find(function (name) {
                return name.indexOf('__reactProps') === 0;
            });
            var props = key ? node[key] : null;
            if (props && (props.onClick || props.onPointerDown || props.onMouseDown)) return props;
            node = node.parentElement;
            guard += 1;
        }
        return null;
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;
        var rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function resolveLive(hint) {
        var list = [];
        if (hint.e2e) {
            list = Array.prototype.slice.call(document.querySelectorAll('[data-e2e="' + hint.e2e + '"]'));
        } else if (hint.aria) {
            list = Array.prototype.slice.call(document.querySelectorAll('[aria-label="' + hint.aria.replace(/"/g, '\\"') + '"]'));
        }
        var i;
        for (i = 0; i < list.length; i++) {
            if (isVisible(list[i]) && reactProps(list[i])) return list[i];
        }
        if (hint.el && hint.el.isConnected && reactProps(hint.el)) return hint.el;
        return null;
    }

    function press(element) {
        var props = reactProps(element);
        if (!props) return;
        try {
            element.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch (error) {}
        var rect = element.getBoundingClientRect();
        var fake = {
            currentTarget: element,
            target: element,
            button: 0,
            buttons: 1,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            preventDefault: function () {},
            stopPropagation: function () {},
            persist: function () {},
            nativeEvent: { isTrusted: true, button: 0 }
        };
        if (props.onPointerDown) props.onPointerDown(Object.assign({ type: 'pointerdown' }, fake));
        if (props.onMouseDown) props.onMouseDown(Object.assign({ type: 'mousedown' }, fake));
        if (props.onClick) props.onClick(Object.assign({ type: 'click', buttons: 0 }, fake));
    }

    var pending = null;
    var waiting = false;

    function pressWhenReady() {
        var target = pending ? resolveLive(pending) : null;
        if (target) {
            waiting = false;
            pending = null;
            try {
                press(target);
            } catch (error) {
                console.warn('TikTok AutoBlocker click failed', error);
            }
            return;
        }
        if (!pending || pending.left <= 0) {
            waiting = false;
            return;
        }
        pending.left -= 1;
        setTimeout(pressWhenReady, 200);
    }

    var observer = new MutationObserver(function () {
        var target = document.querySelector('[data-tiktok-autoblocker-target]');
        if (!target) return;
        var hint = {
            el: target,
            e2e: target.getAttribute('data-e2e'),
            aria: target.getAttribute('aria-label'),
            left: 20
        };
        target.removeAttribute('data-tiktok-autoblocker-target');
        pending = hint;
        if (!waiting) {
            waiting = true;
            pressWhenReady();
        }
    });
    observer.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-tiktok-autoblocker-target']
    });
})();
