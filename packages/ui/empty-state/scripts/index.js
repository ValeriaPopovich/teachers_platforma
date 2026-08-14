export default {
  name: 'UiEmptyState',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    compact: { type: Boolean, default: false },
  },
};
