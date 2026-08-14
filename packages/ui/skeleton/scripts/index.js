import { computed } from 'vue';

export default {
  name: 'UiSkeleton',
  props: {
    width: { type: [String, Number], default: '100%' },
    height: { type: [String, Number], default: 16 },
    shape: {
      type: String,
      default: 'block',
      validator: (value) => ['block', 'text', 'circle'].includes(value),
    },
  },
  setup(props) {
    const size = (value) => (typeof value === 'number' ? `${value}px` : value);
    const skeletonStyle = computed(() => ({
      width: size(props.width),
      height: size(props.height),
    }));
    return { skeletonStyle };
  },
};
