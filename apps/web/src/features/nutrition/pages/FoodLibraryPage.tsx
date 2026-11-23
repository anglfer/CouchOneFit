import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../../components/Icon';
import { PageHeader } from '../../../components/ui';
import RequiresConnection from '../../../components/RequiresConnection';
import { usePwa } from '../../../hooks/usePwa';
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

/** Alimentos y recetas: biblioteca propia del profesional junto al catálogo base. */
export default function FoodLibraryPage() {
  const [foods, setFoods] = useState<OwnFood[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<'own' | 'recipes' | 'catalog'>('own');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<FoodGroup | ''>('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const { isOnline } = usePwa();

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
  const ownFoodItems = (foods ?? []).filter((f) => f.kind === 'food');
  const ownRecipeItems = (foods ?? []).filter((f) => f.kind === 'recipe');
  const ownRows = ownFoodItems.filter((f) => matches(f.name, f.group));
  const recipeRows = ownRecipeItems.filter((f) => matches(f.name, f.group));
  const catalogRows = FOOD_CATALOG.filter((f) => matches(f.name, f.group));

  async function archive(food: OwnFood) {
    const label = food.kind === 'recipe' ? 'receta' : 'alimento';
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
          : `No pudimos archivar ${label === 'receta' ? 'la receta' : 'el alimento'}.`
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
            `Guardaste «${saved.name}» (${saved.kind === 'recipe' ? 'receta' : 'alimento'}). Ya aparece en el editor de planes.`
          );
          setView(saved.kind === 'recipe' ? 'recipes' : 'own');
          setAttempt((n) => n + 1);
        }}
      />
    );

  const start = (draft: FoodDraft, food: OwnFood | null = null) => {
    setNotice('');
    setEditing({ food, draft });
  };

  const renderActions = (f: OwnFood) => (
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
        disabled={!isOnline}
        onClick={() => void archive(f)}
      >
        Archivar
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Alimentos y recetas"
        lead="Separa tus productos o ingredientes individuales de tus recetas completas con ingredientes y pasos de preparación para el móvil del cliente."
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
        <RequiresConnection what="guardar o archivar alimentos propios" />
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
              Mis alimentos{foods ? ` (${ownFoodItems.length})` : ''}
            </button>
            <button
              type="button"
              className="ws-plain"
              aria-pressed={view === 'recipes'}
              onClick={() => setView('recipes')}
            >
              Mis recetas{foods ? ` (${ownRecipeItems.length})` : ''}
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
              placeholder={
                view === 'recipes'
                  ? 'Nombre de la receta'
                  : 'Nombre del alimento'
              }
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
          ) : ownFoodItems.length === 0 ? (
            <section className="ws-card ws-empty">
              <h2 className="ws-card-title text-lg!">
                Aún no tienes alimentos propios
              </h2>
              <p>
                Registra productos, marcas o ingredientes individuales para
                prescribirlos directo o usarlos al armar tus recetas.
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
            <>
              <p className="text-sm text-(--ws-muted)">
                Productos o ingredientes individuales. Se prescriben directo en
                un plan o sirven como base dentro de tus recetas.
              </p>
              <FoodTable
                nameHeader="Alimento"
                referenceHeader="Valores por"
                emptyMessage="Ningún alimento coincide con la búsqueda o el grupo elegido."
                rows={ownRows.map((f) => ({
                  key: f.id,
                  name: f.name,
                  kind: 'food',
                  group: f.group,
                  detail: f.mealCategories.length
                    ? `Preferido en ${f.mealCategories.map((c) => mealLabel[c]).join(', ')}`
                    : (f.preparation ?? ''),
                  reference: reference(f),
                  macros: f,
                  actions: renderActions(f),
                }))}
              />
            </>
          )
        ) : view === 'recipes' ? (
          foods === null ? (
            !error && (
              <div className="ws-skeleton h-40" role="status" aria-busy="true">
                <span className="sr-only">Cargando recetas…</span>
              </div>
            )
          ) : ownRecipeItems.length === 0 ? (
            <section className="ws-card ws-empty">
              <h2 className="ws-card-title text-lg!">
                Aún no tienes recetas registradas
              </h2>
              <p>
                Crea platillos con su lista de ingredientes y pasos de
                preparación. Al prescribir una receta, el cliente verá qué
                necesita y cómo prepararla en su app móvil.
              </p>
              <div className="training-actions justify-center">
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => start(emptyDraft('recipe'))}
                >
                  Nueva receta
                </button>
              </div>
            </section>
          ) : (
            <>
              <p className="text-sm text-(--ws-muted)">
                Platillos con ingredientes y preparación. Al prescribirlos, tu
                cliente verá qué necesita y cómo prepararlos en su app.
              </p>
              <FoodTable
                nameHeader="Receta"
                referenceHeader="Por porción"
                emptyMessage="Ninguna receta coincide con la búsqueda o el grupo elegido."
                rows={recipeRows.map((f) => {
                  const ingredientNames = (f.ingredients ?? [])
                    .slice(0, 3)
                    .map((ing) => ing.name)
                    .join(', ');
                  const ingredientCount = f.ingredients?.length ?? 0;
                  return {
                    key: f.id,
                    name: f.name,
                    kind: 'recipe',
                    group: f.group,
                    detail: [
                      `Rinde ${f.servings ?? 1} ${(f.servings ?? 1) === 1 ? 'porción' : 'porciones'}`,
                      ingredientCount
                        ? `${ingredientCount} ${ingredientCount === 1 ? 'ingrediente' : 'ingredientes'}${ingredientNames ? ` (${ingredientNames}${ingredientCount > 3 ? '…' : ''})` : ''}`
                        : '',
                      f.preparation?.trim()
                        ? 'Con preparación'
                        : 'Sin pasos de preparación',
                      f.mealCategories.length
                        ? `Preferido en ${f.mealCategories.map((c) => mealLabel[c]).join(', ')}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    reference: reference(f),
                    macros: f,
                    actions: renderActions(f),
                  };
                })}
              />
            </>
          )
        ) : (
          <>
            <p className="text-sm text-(--ws-muted)">
              Valores de referencia del sistema. Para ajustar uno a una marca o
              preparación, cópialo a tus alimentos.
            </p>
            <FoodTable
              nameHeader="Alimento"
              referenceHeader="Valores por"
              emptyMessage="Ningún alimento coincide con la búsqueda o el grupo elegido."
              rows={catalogRows.map((f) => ({
                key: f.id,
                name: f.name,
                kind: 'food',
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
  kind: 'food' | 'recipe';
  group: string;
  detail: string;
  reference: string;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  actions: ReactNode;
}

function FoodTable({
  rows,
  nameHeader,
  referenceHeader,
  emptyMessage,
}: {
  rows: TableRow[];
  nameHeader: string;
  referenceHeader: string;
  emptyMessage: string;
}) {
  if (rows.length === 0)
    return <p className="ws-card ws-empty">{emptyMessage}</p>;
  return (
    <div className="ws-card relative overflow-x-auto p-0!">
      <table className="text-sm">
        <thead>
          <tr className="whitespace-nowrap">
            <th scope="col">{nameHeader}</th>
            <th scope="col">Tipo</th>
            <th scope="col">Grupo</th>
            <th scope="col">{referenceHeader}</th>
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
              <td className="whitespace-nowrap">
                <span className="nutrition-kind-badge" data-kind={r.kind}>
                  {r.kind === 'recipe' && <Icon name="bowl" size={12} />}
                  {r.kind === 'recipe' ? 'Receta' : 'Alimento'}
                </span>
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
