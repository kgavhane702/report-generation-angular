export type EditastraToolbarGroupId =
  | 'format'
  | 'script'
  | 'vAlign'
  | 'lists'
  | 'align'
  | 'typography'
  | 'colors';

export type EditastraToolbarPlugin =
  | {
      kind: 'toggle';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      icon:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'strikethrough'
        | 'superscript'
        | 'subscript';
      stateKey: 'isBold' | 'isItalic' | 'isUnderline' | 'isStrikethrough' | 'isSuperscript' | 'isSubscript';
      command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'superscript' | 'subscript';
    }
  | {
      kind: 'vAlign';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      value: 'top' | 'middle' | 'bottom';
      icon: 'vAlignTop' | 'vAlignMiddle' | 'vAlignBottom';
    }
  | {
      kind: 'indent';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      command: 'indentIncrease' | 'indentDecrease';
      icon: 'indentIncrease' | 'indentDecrease';
    }
  | {
      kind: 'mini-separator';
      id: string;
      group: EditastraToolbarGroupId;
    }
  | {
      kind: 'bullet-dropdown';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
    }
  | {
      kind: 'numbered-list';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
    }
  | {
      kind: 'align';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      value: 'left' | 'center' | 'right' | 'justify';
      icon: 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify';
    }
  | {
      kind: 'font-family';
      id: string;
      group: EditastraToolbarGroupId;
      label: string;
      title: string;
    }
  | {
      kind: 'font-size';
      id: string;
      group: EditastraToolbarGroupId;
      label: string;
      title: string;
    }
  | {
      kind: 'line-height';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      icon: 'lineHeight';
    }
  | {
      kind: 'color';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      colorKind: 'text' | 'highlight';
      icon: 'format_color_text' | 'format_ink_highlighter';
    }
  | {
      /** Widget-level background fill (not text highlight). */
      kind: 'widget-background';
      id: string;
      group: EditastraToolbarGroupId;
      title: string;
      icon: 'format_color_fill';
    };

export const EDITASTRA_TOOLBAR_GROUP_ORDER: EditastraToolbarGroupId[] = [
  'format',
  'script',
  'vAlign',
  'lists',
  'align',
  'typography',
  'colors',
];

export const EDITASTRA_TOOLBAR_PLUGINS: EditastraToolbarPlugin[] = [
  // Basic formatting
  { kind: 'toggle', id: 'bold', group: 'format', title: 'Bold', icon: 'bold', stateKey: 'isBold', command: 'bold' },
  { kind: 'toggle', id: 'italic', group: 'format', title: 'Italic', icon: 'italic', stateKey: 'isItalic', command: 'italic' },
  {
    kind: 'toggle',
    id: 'underline',
    group: 'format',
    title: 'Underline',
    icon: 'underline',
    stateKey: 'isUnderline',
    command: 'underline',
  },
  {
    kind: 'toggle',
    id: 'strikethrough',
    group: 'format',
    title: 'Strikethrough',
    icon: 'strikethrough',
    stateKey: 'isStrikethrough',
    command: 'strikethrough',
  },

  // Scripts
  {
    kind: 'toggle',
    id: 'superscript',
    group: 'script',
    title: 'Superscript',
    icon: 'superscript',
    stateKey: 'isSuperscript',
    command: 'superscript',
  },
  {
    kind: 'toggle',
    id: 'subscript',
    group: 'script',
    title: 'Subscript',
    icon: 'subscript',
    stateKey: 'isSubscript',
    command: 'subscript',
  },

  // Vertical alignment (PPT-like)
  { kind: 'vAlign', id: 'vAlignTop', group: 'vAlign', title: 'Align Top', value: 'top', icon: 'vAlignTop' },
  {
    kind: 'vAlign',
    id: 'vAlignMiddle',
    group: 'vAlign',
    title: 'Align Middle',
    value: 'middle',
    icon: 'vAlignMiddle',
  },
  { kind: 'vAlign', id: 'vAlignBottom', group: 'vAlign', title: 'Align Bottom', value: 'bottom', icon: 'vAlignBottom' },

  // Lists / indent
  { kind: 'indent', id: 'indentDecrease', group: 'lists', title: 'Decrease indent', command: 'indentDecrease', icon: 'indentDecrease' },
  { kind: 'indent', id: 'indentIncrease', group: 'lists', title: 'Increase indent', command: 'indentIncrease', icon: 'indentIncrease' },
  { kind: 'mini-separator', id: 'lists-mini-sep-1', group: 'lists' },
  { kind: 'bullet-dropdown', id: 'bulletStyle', group: 'lists', title: 'Bullet list' },
  { kind: 'numbered-list', id: 'numberedList', group: 'lists', title: 'Numbered list' },

  // Text alignment
  { kind: 'align', id: 'alignLeft', group: 'align', title: 'Align Left', value: 'left', icon: 'alignLeft' },
  { kind: 'align', id: 'alignCenter', group: 'align', title: 'Align Center', value: 'center', icon: 'alignCenter' },
  { kind: 'align', id: 'alignRight', group: 'align', title: 'Align Right', value: 'right', icon: 'alignRight' },
  { kind: 'align', id: 'alignJustify', group: 'align', title: 'Justify', value: 'justify', icon: 'alignJustify' },

  // Typography
  { kind: 'font-family', id: 'fontFamily', group: 'typography', label: 'Font', title: 'Font family' },
  { kind: 'font-size', id: 'fontSize', group: 'typography', label: 'Size', title: 'Font size' },
  { kind: 'line-height', id: 'lineHeight', group: 'typography', title: 'Line height', icon: 'lineHeight' },

  // Colors
  { kind: 'color', id: 'textColor', group: 'colors', title: 'Text color', colorKind: 'text', icon: 'format_color_text' },
  {
    kind: 'color',
    id: 'textHighlight',
    group: 'colors',
    title: 'Text highlight',
    colorKind: 'highlight',
    icon: 'format_ink_highlighter',
  },
  {
    kind: 'widget-background',
    id: 'backgroundColor',
    group: 'colors',
    title: 'Background color',
    icon: 'format_color_fill',
  },
];


