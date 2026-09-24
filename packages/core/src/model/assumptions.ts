/**
 * Modelling choices that are not measured shop constants.
 * They are part of the product contract until a construction variant replaces them.
 */
export const MODEL_ASSUMPTIONS: readonly { id: string; text: string }[] = [
  {
    id: "closed-box-topology",
    text: "Закрытая коробка из шести отдельных панелей. Перед и зад — полные внешние ширина и высота. Лево и право стоят между ними. Дно и крышка вложены между четырьмя стенками. Линий сгиба нет.",
  },
  {
    id: "thickness-count",
    text: "Для этой топологии между внутренним и внешним размером по каждой оси лежат две толщины: ширина — лево и право, глубина — перед и зад, высота — дно и крышка. Число толщин принадлежит описанию конструкции, а не универсальной формуле.",
  },
  {
    id: "tab-on-inset",
    text: "Шипы стоят на вложенных панелях (лево, право, дно, крышка). Пазы — краевые вырезы на принимающих панелях. Выступ шипа равен толщине ответной панели, поэтому внешняя грань получается заподлицо.",
  },
  {
    id: "clearance",
    text: "Clearance увеличивает только паз: вдоль кромки симметрично и вглубь панели со внутренней стороны. Керф в номинальный размер не входит и сдвигает только траекторию реза в сторону отходов на kerf/2.",
  },
  {
    id: "edge-margin",
    text: "Поле кромки должно быть не меньше толщины + 1.5 × clearance, иначе паз у угла пересечёт паз соседней кромки. Автораскладка шипов это поле не подменяет.",
  },
  {
    id: "tab-pitch",
    text: "Если число шипов не задано, вдоль контакта ставится максимум шипов ширины tabWidth с промежутком не меньше minGap. Это правило раскладки, не производственный норматив.",
  },
  {
    id: "outer-face",
    text: "2D-координаты панели лежат на внешней грани. Гравировка по умолчанию относится к этой же грани. Начало панели — угол номинального прямоугольника, ось Y вверх.",
  },
  {
    id: "presets",
    text: "Стартовые tabWidth, edgeMargin и minGap в интерфейсе — предлагаемый набор, а не утверждённые коэффициенты. Геометрическое ядро принимает их как входные параметры.",
  },
];

export interface TabSlotPreset {
  tabWidth: number;
  edgeMargin: number;
  minGap: number;
  assumptions: string[];
}

/**
 * Starting values for the UI. Not a certified fit.
 * tabWidth = 2 × thickness, minGap = thickness,
 * edgeMargin = thickness + 1.5 × clearance (corner clearance of this construction).
 */
export function suggestTabSlotPreset(thickness: number, clearance: number): TabSlotPreset {
  const safeThickness = Math.max(thickness, 0);
  const safeClearance = Math.max(clearance, 0);
  return {
    tabWidth: roundMm(safeThickness * 2),
    edgeMargin: roundMm(safeThickness + safeClearance * 1.5),
    minGap: roundMm(safeThickness),
    assumptions: [
      "tabWidth = 2 × толщина — пропорция для старта, заменяется параметром.",
      "minGap = толщина — пропорция для старта, заменяется параметром.",
      "edgeMargin = толщина + 1.5 × clearance — минимум, при котором угловые пазы этой конструкции не пересекаются.",
    ],
  };
}

function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000;
}
