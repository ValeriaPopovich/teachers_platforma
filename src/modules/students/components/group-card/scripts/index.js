import { UiIcon } from '@icons';
import { UiCard, UiMenu } from '@ui';
import { computed } from 'vue';

import { GROUP_CARD_MENU_ITEMS } from './constants.js';

export default {
  name: 'GroupCard',
  components: { UiCard, UiIcon, UiMenu },
  props: {
    /** Подготовленные данные карточки учебной группы. */
    row: { type: Object, required: true },
  },
  setup(props) {
    const groupId = computed(() => props.row.group.id);
    const groupName = computed(() => props.row.group.name);
    const optionsLabel = computed(() => `Опции группы ${groupName.value}`);
    const openGroupLabel = computed(() => `Открыть группу: ${groupName.value}`);
    const menuItems = GROUP_CARD_MENU_ITEMS;
    return { groupId, menuItems, openGroupLabel, optionsLabel };
  },
};
