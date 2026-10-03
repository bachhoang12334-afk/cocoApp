import { supabase } from './supabaseClient'
import { getAccountDeletionErrorMessage } from './accountDeletionRules'

export {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
} from './accountDeletionRules'

export async function deleteCurrentAccount() {
  const { error } = await supabase.rpc('delete_my_account')

  if (error) {
    throw new Error(getAccountDeletionErrorMessage(error))
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })

  return {
    sessionCleared: !signOutError,
  }
}
