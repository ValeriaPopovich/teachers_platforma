import { UiModal } from '@ui';
import { computed, ref } from 'vue';

import { useAppState } from '../../../../../state/use-app-state.js';
import { closeEventForm, eventFormUi } from '../../../schedule-ui.js';
import EventFormBody from '../../event-form-body/index.vue';

export default {
  name: 'EventForm',
  components: { UiModal, EventFormBody },
  setup() {
    const state = useAppState();
    const dirty = ref(false);
    const event = computed(() =>
      eventFormUi.eventId
        ? state.value.events.find((item) => item.id === eventFormUi.eventId) || null
        : null,
    );
    const modalTitle = computed(() =>
      eventFormUi.eventId ? 'Редактировать событие' : 'Своё событие',
    );
    return {
      eventFormUi,
      event,
      modalTitle,
      dirty,
      shouldConfirmClose: () => dirty.value,
      onModalClose: closeEventForm,
    };
  },
};
