import { UiIcon } from '@icons';
import { UiCard, UiMenu } from '@ui';
import { computed } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { studentsService } from '../../../students.service.js';
import { openEditGroup } from '../../../students-ui.js';
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

    function onCardClick() {
      openEditGroup(groupId.value);
    }

    async function onMenuSelect(action) {
      if (action === 'edit') openEditGroup(groupId.value);
      if (action === 'delete') {
        if (
          !(await dialog.ask(
            `Удалить группу «${groupName.value}» и все её занятия?`,
            'Удаление группы',
            'Удалить',
          ))
        )
          return;
        studentsService.removeGroup(groupId.value);
        toast('Группа удалена');
      }
    }

    return { groupId, menuItems, onCardClick, onMenuSelect, openGroupLabel, optionsLabel };
  },
};
