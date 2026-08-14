import UiSkeleton from '../../skeleton/index.vue';

const BLOCK_COUNTS = {
  dashboard: 3,
  schedule: 2,
  students: 4,
  payments: 3,
  reports: 2,
  board: 3,
  settings: 4,
};

export default {
  name: 'UiPageSkeleton',
  components: { UiSkeleton },
  props: {
    variant: {
      type: String,
      required: true,
      validator: (value) => Object.hasOwn(BLOCK_COUNTS, value),
    },
  },
  computed: {
    blockCount() {
      return BLOCK_COUNTS[this.variant];
    },
  },
};
