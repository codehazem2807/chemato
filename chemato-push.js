(function () {
    const appId = String(window.CHEMATO_ONESIGNAL_APP_ID || '').trim();
    const configured = /^[0-9a-f-]{36}$/i.test(appId);

    if (!configured) {
        window.ChematoPush = { configured: false };
        return;
    }

    let sdk = null;
    let userId = null;
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
        try {
            await OneSignal.init({
                appId,
                autoResubscribe: true,
                serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
                serviceWorkerParam: { scope: '/push/onesignal/' },
                welcomeNotification: { disable: true },
            });
            sdk = OneSignal;
            OneSignal.Notifications.addEventListener('permissionChange', (permission) => {
                window.dispatchEvent(new CustomEvent('chemato-push-permission-change', {
                    detail: { permission },
                }));
            });
            if (userId) await OneSignal.login(userId);
            resolveReady(OneSignal);
        } catch (error) {
            rejectReady(error);
        }
    });

    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onerror = () => rejectReady(new Error('OneSignal SDK failed to load'));
    document.head.appendChild(script);

    window.ChematoPush = {
        configured: true,
        async login(externalId) {
            userId = externalId;
            const instance = await ready;
            await instance.login(externalId);
        },
        async status() {
            const instance = await ready;
            return {
                supported: instance.Notifications.isPushSupported(),
                permission: Notification.permission,
                subscribed: Boolean(instance.User.PushSubscription.optedIn),
            };
        },
        async enable() {
            const instance = await ready;
            if (!instance.Notifications.isPushSupported()) return false;
            await instance.Notifications.requestPermission();
            if (instance.Notifications.permission) await instance.User.PushSubscription.optIn();
            return true;
        },
        async disable() {
            const instance = await ready;
            await instance.User.PushSubscription.optOut();
        },
    };
})();