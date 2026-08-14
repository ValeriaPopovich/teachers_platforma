import { UiIcon } from '@icons';

import UiTooltip from '../../tooltip/index.vue';

export default {
  name: 'UiHint',
  components: { UiIcon, UiTooltip },
  props: {
    /** Текст пояснения, которое показывается рядом с полем или показателем. */
    text: { type: String, required: true },
    /** Доступное имя кнопки подсказки. */
    label: { type: String, default: 'Показать подсказку' },
  },
};
