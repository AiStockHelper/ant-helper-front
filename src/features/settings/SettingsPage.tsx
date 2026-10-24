import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageBody, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Field, Segmented } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDate } from '@/lib/format'
import { useTheme, type ThemeMode } from './ThemeContext'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const { user, updateNickname, logout, deleteAccount } = useAuth()
  const { mode, setMode } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [nickError, setNickError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const dirty = nickname.trim() !== user?.nickname

  const saveNickname = async (e: FormEvent) => {
    e.preventDefault()
    const next = nickname.trim()
    if (!next) return setNickError('닉네임을 입력해 주세요.')
    if (next.length > 20) return setNickError('닉네임은 20자 이하로 입력해 주세요.')
    setNickError(null)
    setSaving(true)
    try {
      await updateNickname(next)
      toast.success('닉네임을 변경했어요.')
    } catch (err) {
      setNickError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader title="설정" />
      <PageBody>
        <div className="mx-auto max-w-2xl">
          <Section title="프로필" description={user ? `${user.email} · 가입일 ${formatDate(user.createdAt)}` : undefined}>
            <form onSubmit={saveNickname} className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Field label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} error={nickError} maxLength={20} className="flex-1" />
              <Button type="submit" variant="primary" loading={saving} disabled={!dirty} className="sm:mt-[26px]">
                저장
              </Button>
            </form>
          </Section>

          <Section title="화면 테마" description="시스템 설정을 따르거나 직접 선택할 수 있어요.">
            <Segmented<ThemeMode>
              label="화면 테마"
              value={mode}
              onChange={setMode}
              className="w-full sm:w-auto"
              options={[
                { value: 'system', label: <><Monitor className="h-4 w-4" aria-hidden />시스템</> },
                { value: 'light', label: <><Sun className="h-4 w-4" aria-hidden />라이트</> },
                { value: 'dark', label: <><Moon className="h-4 w-4" aria-hidden />다크</> },
              ]}
            />
          </Section>

          <Section title="계정">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setConfirmLogout(true)}>
                <LogOut className="h-4 w-4" aria-hidden />
                로그아웃
              </Button>
              <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                회원 탈퇴
              </Button>
            </div>
          </Section>

          <p className="pb-4 text-center text-xs text-subtle">Ant Helper v2 · 투자 판단의 책임은 본인에게 있습니다.</p>
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmLogout}
        title="로그아웃할까요?"
        confirmLabel="로그아웃"
        onConfirm={async () => {
          await logout()
          navigate('/login', { replace: true })
        }}
        onClose={() => setConfirmLogout(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="정말 탈퇴하시겠어요?"
        description="계정과 연결된 모든 계좌 정보, 대화 이력, 예약 작업이 삭제되며 되돌릴 수 없습니다."
        confirmLabel="회원 탈퇴"
        destructive
        loading={deleting}
        confirmDisabled={deleteText !== '탈퇴'}
        onConfirm={doDelete}
        onClose={() => {
          setConfirmDelete(false)
          setDeleteText('')
        }}
      >
        <Field label="확인을 위해 ‘탈퇴’ 를 입력하세요" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
      </ConfirmDialog>
    </div>
  )
}
