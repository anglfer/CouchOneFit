import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../../components/Icon';
import { PageHeader } from '../../../components/ui';
import { confirmDialog } from '../../../services/confirm';
import OwnFoodEditor from '../components/OwnFoodEditor';
import {
  draftFromCatalog,
  draftFromOwn,
  emptyDraft,
  type FoodDraft,
} from '../utils/foodDraft';
import { archiveOwnFood, readOwnFoods } from '../services/foodLibrary';
import type { OwnFood } from '../types/foodLibrary';
import {
  FOOD_CATALOG,
  FOOD_GROUPS,
  MEAL_CATEGORY_OPTIONS,
  normalizeCatalogText,
  type FoodGroup,
} from '../utils/foodCatalog';

type Editing = { food: OwnFood | null; draft: FoodDraft };

const mealLabel = Object.fromEntries(MEAL_CATEGORY_OPTIONS);

const reference = (f: { basis: string; defaultUnit: string }): string =>
  f.basis === 'per_100'
    ? `100 ${f.defaultUnit === 'ml' ? 'ml' : 'g'}`
    : `1 ${f.defaultUnit}`;

/** Alimentos: the professional's own foods and recipes, next to the curated base catalog. */
export default function FoodLibraryPage() {
  const [foods, setFoods] = useState<OwnFood[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<'own' | 'catalog'>('own');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<FoodGroup | ''>('');
  const [editing, setEditing] = useState<Editing | null>(null);

  useEffect(() => {
    let live = true;
    readOwnFoods()
      .then((list) => {
        if (live) {
          setFoods(list);
          setError('');
        }
      })
      .catch(() => {
        if (live)
          setError(
            'No pudimos consultar tu biblioteca de alimentos. Revisa tu conexión e inténtalo de nuevo.'
          );
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const matches = (name: string, foodGroup: string) =>
    (!group || foodGroup === group) &&
    normalizeCatalogText(name).includes(normalizeCatalogText(query));
  const ownRows = (foods ?? []).filter((f) => matches(f.name, f.group));
  const catalogRows = FOOD_CATALOG.filter((f) => matches(f.name, f.group));

  async function archive(food: OwnFood) {
    if (
      !(await confirmDialog({
        title: `¿Archivar «${food.name}»?`,
        message:
          'Deja de aparecer en el editor de planes y en las sugerencias. Los planes que ya lo incluyen no cambian.',
        confirmLabel: 'Archivar',
        danger: true,
      }))
    )
      return;
    try {
      await archiveOwnFood(food);
      setNotice(`Archivaste «${food.name}».`);
      setAttempt((n) => n + 1);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : 'No pudimos archivar el alimento.'
      );
    }
  }

  if (editing)
    return (
      <OwnFoodEditor
        key={editing.food?.id ?? 'new'}
        food={editing.food}
        initial={editing.draft}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          setNotice(
            `Guardaste «${saved.name}». Ya aparece en el editor de planes.`
          );
          setView('own');
          setAttempt((n) => n + 1);
        }}
      />
    );

  const start = (draft: FoodDraft, food: OwnFood | null = null) => {
    setNotice('');
    setEditing({ food, draft });
  };

  return (
    <>
      <PageHeader
        title="Alimentos"
        lead="Tus alimentos y recetas con sus macros. Aparecen en el editor de planes junto al catálogo base, y «Sugerir alimentos» los usa en los tiempos de comida que elijas."
        actions={
          <>
            <button
              type="button"
              className="ws-btn"
              onClick={() => start(emptyDraft('recipe'))}
            >
              <Icon name="bowl" size={18} />
              Nueva receta
            </button>
            <button
              type="button"
              className="ws-btn"
              data-variant="primary"
              onClick={() => start(emptyDraft())}
            >
              <Icon name="plus" size={18} />
              Nuevo alimento
            </button>
          </>
        }
      />

      <div className="space-y-4">
        {notice && (
          <p role="status" className="ws-alert" data-tone="ok">
            <Icon name="check" size={16} className="inline align-[-3px]" />{' '}
            {notice}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="ws-alert flex flex-wrap items-center justify-between gap-3"
            data-tone="bad"
          >
            <span>{error}</span>
            <button
              type="button"
              className="ws-btn"
              onClick={() => {
                setError('');
                setAttempt((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="ws-card flex flex-wrap items-end gap-3 p-4!">
          <div
            className="ws-segmented m-0!"
            role="group"
            aria-label="Biblioteca"
          >
            <button
              type="button"
              className="ws-plain"
              aria-pressed={view === 'own'}
              onClick={() => setView('own')}
            >
              Mis alimentos{foods ? ` (${foods.length})` : ''}
            </button>
            <button
              type="button"
              className="ws-plain"
              aria-pressed={view === 'catalog'}
              onClick={() => setView('catalog')}
            >
              Catálogo base ({FOOD_CATALOG.length})
            </button>
          </div>
          <label className="min-w-48 flex-1">
            Buscar
            <input
              type="search"
              className="block w-full"
              value={query}
              placeholder="Nombre del alimento"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Grupo
            <select
              className="block"
              value={group}
              onChange={(e) => setGroup(e.target.value as FoodGroup | '')}
            >
              <option value="">Todos</option>
              {FOOD_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>

        {view === 'own' ? (
          foods === null ? (
            !error && (
              <div className="ws-skeleton h-40" role="status" aria-busy="true">
                <span className="sr-only">Cargando alimentos…</span>
              </div>
            )
          ) : foods.length === 0 ? (
            <section className="ws-card ws-empty">
              <h2 className="ws-card-title text-lg!">
                Aún no tienes alimentos propios
              </h2>
              <p>
                Registra las marcas, preparaciones y recetas que usas con tus
                clientes. Puedes empezar desde cero o copiar uno del catálogo
                base para ajustarlo.
              </p>
              <div className="training-actions justify-center">
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => start(emptyDraft())}
                >
                  Nuevo alimento
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => setView('catalog')}
                >
                  Ver catálogo base
                </button>
              </div>
            </section>
          ) : (
            <FoodTable
              rows={ownRows.map((f) => ({
                key: f.id,
                name: f.name,
                group: f.group,
                detail: [
                  f.kind === 'recipe'
                    ? `Receta · rinde ${f.servings} ${f.servings === 1 ? 'porción' : 'porciones'}`
                    : '',
                  f.mealCategories.length
                    ? `Preferido en ${f.mealCategories.map((c) => mealLabel[c]).join(', ')}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
                reference: reference(f),
                macros: f,
                actions: (
                  <>
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() => start(draftFromOwn(f), f)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() => void archive(f)}
                    >
                      Archivar
                    </button>
                  </>
                ),
              }))}
            />
          )
        ) : (
          <>
            <p className="text-sm text-(--ws-muted)">
              Valores de referencia del sistema. Para ajustar uno a una marca o
              preparación, cópialo a tus alimentos.
            </p>
            <FoodTable
              rows={catalogRows.map((f) => ({
                key: f.id,
                name: f.name,
                group: f.group,
                detail: f.preparationHint,
                reference: reference(f),
                macros: f,
                actions: (
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => start(draftFromCatalog(f))}
                  >
                    Copiar a mis alimentos
                  </button>
                ),
              }))}
            />
          </>
        )}
      </div>
    </>
  );
}

interface TableRow {
  key: string;
  name: string;
  group: string;
  detail: string;
  reference: string;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  actions: ReactNode;
}

function FoodTable({ rows }: { rows: TableRow[] }) {
  if (rows.length === 0)
    return (
      <p className="ws-card ws-empty">
        Ningún alimento coincide con la búsqueda o el grupo elegido.
      </p>
    );
  return (
    <div className="ws-card relative overflow-x-auto p-0!">
      <table className="text-sm">
        <thead>
          <tr className="whitespace-nowrap">
            <th scope="col">Alimento</th>
            <th scope="col">Grupo</th>
            <th scope="col">Valores por</th>
            <th scope="col" className="text-right!">
              kcal
            </th>
            <th scope="col" className="text-right!">
              Prot.
            </th>
            <th scope="col" className="text-right!">
              Carb.
            </th>
            <th scope="col" className="text-right!">
              Grasa
            </th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="min-w-52">
                <strong className="font-semibold">{r.name}</strong>
                {r.detail && (
                  <span className="block text-xs text-(--ws-muted)">
                    {r.detail}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap text-(--ws-text-2)">
                {r.group}
              </td>
              <td className="whitespace-nowrap">{r.reference}</td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {r.macros.calories}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {r.macros.proteinG} g
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {r.macros.carbsG} g
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {r.macros.fatG} g
              </td>
              <td>
                <div className="flex justify-end gap-2 whitespace-nowrap">
                  {r.actions}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
