import { onBeforeUnmount, onMounted, ref } from 'vue';

export function millisecondsToNextMinute(now = Date.now()) {
  return 60_000 - (now % 60_000) + 20;
}

export function createMinuteClock({
  onTick,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  documentRef = globalThis.document,
}) {
  let timer = null;

  function schedule() {
    if (timer != null) clearTimer(timer);
    timer = setTimer(() => {
      onTick(new Date(now()));
      schedule();
    }, millisecondsToNextMinute(now()));
  }

  function onVisibilityChange() {
    if (documentRef?.visibilityState !== 'hidden') {
      onTick(new Date(now()));
      schedule();
    }
  }

  return {
    start() {
      onTick(new Date(now()));
      schedule();
      documentRef?.addEventListener('visibilitychange', onVisibilityChange);
    },
    stop() {
      if (timer != null) clearTimer(timer);
      timer = null;
      documentRef?.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}

export function useMinuteNow() {
  const value = ref(new Date());
  const clock = createMinuteClock({ onTick: (date) => (value.value = date) });
  onMounted(clock.start);
  onBeforeUnmount(clock.stop);
  return value;
}
