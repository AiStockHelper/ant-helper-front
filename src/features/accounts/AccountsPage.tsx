import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, Landmark, Pencil, PieChart, Plus, Star, Trash2 } from 'lucide-react'
import { accountsApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { PageBody, PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/finance/parts'
import { AccountTypeBadge, Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Segmented } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/format'
import type { Account, AccountType } from '@/api/types'
import { useAccounts } from './useAccounts'

export const KIS_PORTAL_URL = 'https://apiportal.koreainvestment.com'

function AccountCard({
  account,
  onRename,
  onDelete,
  onSetDefault,
  settingDefault,
}: {
  account: Account
  onRename: (a: Account) => void
  onDelete: (a: Account) => void
  onSetDefault: (a: Account) => void
  settingDefault: boolean
}) {
  const real = account.accountType === 'REAL_TRADE'
  return (
    <li className={`overflow-hidden rounded-2xl border bg-surface shadow-card ${real ? 'border-real/40' : 'border-border'}`}>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AccountTypeBadge type={account.accountType} />
          {account.isDefault && (
            <Badge tone="brand">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              기본
            </Badge>
          )}
        </div>
        <h3 className="mt-2 truncate text-base font-bold">{account.alias}</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-subtle">계좌번호</dt>
            <dd className="tabular font-medium">
              {account.accountNumberMasked}
              {account.accountProductCode && !account.accountNumberMasked.includes('-') ? `-${account.accountProductCode}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">등록일</dt>
            <dd className="font-medium">{formatDate(account.createdAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-border bg-surface-2/50 px-2 py-1.5">
        <Link
          to={`/portfolio?account=${account.id}`}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand-text hover:bg-surface-2 md:h-9"
        >
          <PieChart className="h-4 w-4" aria-hidden />
          자산 보기
        </Link>
        {!account.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => onSetDefault(account)} disabled={settingDefault}>
            <Star className="h-4 w-4" aria-hidden />
            기본으로
          </Button>
        )}
        <div className="ml-auto flex">
          <Button variant="ghost" size="icon-sm" onClick={() => onRename(account)} aria-label={`${account.alias} 별칭 변경`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(account)} aria-label={`${account.alias} 삭제`} className="hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  )
}

function RenameDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [alias, setAlias] = useState(account?.alias ?? '')
  const [error, setError] = useState<string | null>(null)
  const m = useMutation({
    mutationFn: () => accountsApi.update(account!.id, { alias: alias.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('별칭을 변경했어요.')
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!alias.trim()) {
      setError('별칭을 입력해 주세요.')
      return
    }
    m.mutate()
  }
  return (
    <Dialog
      open={!!account}
      onClose={onClose}
      title="별칭 변경"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" type="submit" form="rename-form" loading={m.isPending}>
            저장
          </Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit}>
        <Field label="별칭" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={30} error={error} data-autofocus />
      </form>
    </Dialog>
  )
}

function AddAccountDialog({ open, onClose, isFirst }: { open: boolean; onClose: () => void; isFirst: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [type, setType] = useState<AccountType>('PAPER_TRADE')
  const [alias, setAlias] = useState('')
  const [appKey, setAppKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [productCode, setProductCode] = useState('01')
  const [ack, setAck] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const real = type === 'REAL_TRADE'

  const reset = () => {
    setType('PAPER_TRADE')
    setAlias('')
    setAppKey('')
    setSecretKey('')
    setAccountNumber('')
    setProductCode('01')
    setAck(false)
    setErrors({})
    setServerError(null)
  }

  const m = useMutation({
    mutationFn: () =>
      accountsApi.create({
        accountType: type,
        alias: alias.trim() || undefined,
        appKey: appKey.trim(),
        secretKey: secretKey.trim(),
        accountNumber,
        accountProductCode: productCode,
      }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(`${a.alias} 계좌를 등록했어요.`)
      reset()
      onClose()
    },
    onError: (e) => setServerError(errorMessage(e, '계좌를 등록하지 못했습니다.')),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!appKey.trim()) next.appKey = 'App Key 를 입력해 주세요.'
    if (!secretKey.trim()) next.secretKey = 'Secret Key 를 입력해 주세요.'
    if (!/^\d{8}$/.test(accountNumber)) next.accountNumber = '계좌번호 앞 8자리 숫자를 입력해 주세요.'
    if (!/^\d{2}$/.test(productCode)) next.productCode = '상품코드 2자리 숫자를 입력해 주세요.'
    if (real && !ack) next.ack = '실전 계좌 연결 안내를 확인해 주세요.'
    setErrors(next)
    setServerError(null)
    if (Object.keys(next).length === 0) m.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose()
      }}
      title="증권 계좌 추가"
      description={
        <>
          한국투자증권 Open API 키로 연결합니다.{' '}
          <a href={KIS_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-text underline">
            앱키 발급 안내
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={m.isPending}>
            취소
          </Button>
          <Button variant={real ? 'real' : 'primary'} type="submit" form="add-account-form" loading={m.isPending}>
            {m.isPending ? '검증 중…' : '검증하고 추가'}
          </Button>
        </>
      }
    >
      <form id="add-account-form" onSubmit={submit} className="space-y-4" noValidate autoComplete="off">
        <div>
          <p className="mb-1.5 text-sm font-medium">계좌 유형</p>
          <Segmented
            label="계좌 유형"
            value={type}
            onChange={setType}
            className="w-full"
            options={[
              { value: 'PAPER_TRADE', label: '모의투자' },
              { value: 'REAL_TRADE', label: '실전투자' },
            ]}
          />
        </div>
        {real && (
          <div className="rounded-xl border border-real/50 bg-real-soft p-3.5 text-sm text-real" role="note">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              실전 계좌는 실제 자금으로 거래됩니다.
            </p>
            <p className="mt-1 pl-6 text-xs leading-relaxed">
              AI 가 만든 주문은 항상 확인 카드를 통해 직접 승인해야 실행됩니다. 키는 암호화되어 서버에만 저장되며, 타인과 공유하지 마세요.
            </p>
            <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-2.5 pl-6 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--real-solid))]" />
              위 내용을 이해했습니다.
            </label>
            {errors.ack && <p className="pl-6 text-xs font-medium">{errors.ack}</p>}
          </div>
        )}
        <Field label="별칭 (선택)" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={30} placeholder={real ? '실전 계좌' : '모의 계좌'} />
        <Field label="App Key" value={appKey} onChange={(e) => setAppKey(e.target.value)} error={errors.appKey} autoComplete="off" spellCheck={false} />
        <Field
          label="Secret Key"
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          error={errors.secretKey}
          autoComplete="new-password"
          spellCheck={false}
        />
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field
            label="계좌번호 (8자리)"
            inputMode="numeric"
            value={accountNumber}
            maxLength={8}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            error={errors.accountNumber}
            placeholder="12345678"
          />
          <Field
            label="상품코드"
            inputMode="numeric"
            value={productCode}
            maxLength={2}
            onChange={(e) => setProductCode(e.target.value.replace(/\D/g, ''))}
            error={errors.productCode}
          />
        </div>
        {serverError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        {isFirst && <p className="text-xs text-subtle">첫 번째 계좌는 자동으로 기본 계좌로 설정됩니다.</p>}
      </form>
    </Dialog>
  )
}

export function AccountsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { accounts, isLoading, isError, error, refetch } = useAccounts()
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)

  const setDefault = useMutation({
    mutationFn: (a: Account) => accountsApi.update(a.id, { isDefault: true }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(`${a.alias} 을(를) 기본 계좌로 설정했어요.`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (a: Account) => accountsApi.remove(a.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['conversation'] })
      toast.success('계좌를 삭제했어요.')
      setDeleting(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const real = accounts.filter((a) => a.accountType === 'REAL_TRADE')
  const paper = accounts.filter((a) => a.accountType === 'PAPER_TRADE')

  const renderGroup = (title: string, desc: string, list: Account[]) =>
    list.length > 0 && (
      <section className="mb-8" aria-label={title}>
        <div className="mb-3">
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-muted">{desc}</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onRename={setRenaming}
              onDelete={setDeleting}
              onSetDefault={(x) => setDefault.mutate(x)}
              settingDefault={setDefault.isPending}
            />
          ))}
        </ul>
      </section>
    )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="계좌 관리"
        description="모의·실전 계좌를 등록하고 기본 계좌를 정하세요."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">계좌 추가</span>
            <span className="sm:hidden">추가</span>
          </Button>
        }
      />
      <PageBody>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Landmark className="h-6 w-6" />}
            title="계좌 목록을 불러오지 못했어요"
            description={errorMessage(error)}
            action={<Button variant="outline" onClick={() => refetch()}>다시 시도</Button>}
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Landmark className="h-6 w-6" />}
            title="등록된 계좌가 없어요"
            description="한국투자증권 Open API 키로 모의 또는 실전 계좌를 연결하면 채팅에서 시세 조회와 주문을 할 수 있어요."
            action={
              <div className="flex flex-col items-center gap-2">
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  계좌 추가
                </Button>
                <a href={KIS_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-text underline">
                  앱키 발급 안내 (한국투자증권 개발자센터)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            }
          />
        ) : (
          <>
            {renderGroup('실전 계좌', '실제 자금으로 거래되는 계좌입니다. AI 주문은 확인 카드 승인 후 실행돼요.', real)}
            {renderGroup('모의 계좌', '가상 자금으로 연습하는 계좌입니다. 주문이 즉시 실행돼요.', paper)}
            <p className="text-xs text-subtle">
              앱키가 필요하신가요?{' '}
              <a href={KIS_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-text underline">
                한국투자증권 개발자센터
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          </>
        )}
      </PageBody>

      {adding && <AddAccountDialog open onClose={() => setAdding(false)} isFirst={accounts.length === 0} />}
      {renaming && <RenameDialog key={renaming.id} account={renaming} onClose={() => setRenaming(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="계좌를 삭제할까요?"
        description={
          deleting && (
            <>
              <strong>{deleting.alias}</strong> 계좌 연결을 삭제합니다. 예약된 작업이 있다면 함께 취소될 수 있어요.
              {deleting.accountType === 'REAL_TRADE' && ' 증권사의 실제 계좌는 삭제되지 않습니다.'}
            </>
          )
        }
        confirmLabel="삭제"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
