use anchor_lang::prelude::*;

declare_id!("uiTZySgzCQVi1z8TaQcSgmcn5rVcqb7jXp7dS4sgYie");

const MAX_WINDOW_SECONDS: i64 = 31_536_000;

#[program]
pub mod freelance_escrow {
    use super::*;

    pub fn create_agreement(
        ctx: Context<CreateAgreement>,
        agreement_id: [u8; 16],
        provider: Pubkey,
        primary_resolver: Pubkey,
        backup_resolver: Pubkey,
        amount_lamports: u64,
        delivery_window_seconds: i64,
        review_window_seconds: i64,
        resolver_window_seconds: i64,
        terms_hash: [u8; 32],
    ) -> Result<()> {
        let requester = ctx.accounts.requester.key();
        require!(amount_lamports > 0, EscrowError::InvalidAmount);
        require!(
            delivery_window_seconds > 0
                && delivery_window_seconds <= MAX_WINDOW_SECONDS
                && review_window_seconds > 0
                && review_window_seconds <= MAX_WINDOW_SECONDS
                && resolver_window_seconds > 0
                && resolver_window_seconds <= MAX_WINDOW_SECONDS,
            EscrowError::InvalidWindow
        );
        require!(provider != requester, EscrowError::InvalidRoles);
        require!(
            primary_resolver != backup_resolver,
            EscrowError::InvalidRoles
        );
        require!(
            primary_resolver != requester
                && primary_resolver != provider
                && backup_resolver != requester
                && backup_resolver != provider,
            EscrowError::InvalidRoles
        );

        let agreement = &mut ctx.accounts.agreement;
        agreement.id = agreement_id;
        agreement.requester = requester;
        agreement.provider = provider;
        agreement.primary_resolver = primary_resolver;
        agreement.backup_resolver = backup_resolver;
        agreement.amount_lamports = amount_lamports;
        agreement.terms_hash = terms_hash;
        agreement.status = AgreementStatus::Proposed;
        agreement.resolver_stage = ResolverStage::None;
        agreement.delivery_window_seconds = delivery_window_seconds;
        agreement.review_window_seconds = review_window_seconds;
        agreement.resolver_window_seconds = resolver_window_seconds;
        agreement.delivery_deadline = 0;
        agreement.review_deadline = 0;
        agreement.resolver_deadline = 0;
        agreement.submitted_result_hash = [0; 32];
        agreement.bump = ctx.bumps.agreement;
        agreement.vault_bump = ctx.bumps.vault;

        let vault = &mut ctx.accounts.vault;
        vault.agreement = agreement.key();
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn accept_agreement(
        ctx: Context<AcceptAgreement>,
        presented_terms_hash: [u8; 32],
    ) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Proposed,
            EscrowError::InvalidState
        );
        require_keys_eq!(
            ctx.accounts.provider.key(),
            agreement.provider,
            EscrowError::Unauthorized
        );
        require!(
            presented_terms_hash == agreement.terms_hash,
            EscrowError::TermsHashMismatch
        );
        agreement.status = AgreementStatus::Accepted;
        Ok(())
    }

    pub fn fund_agreement(ctx: Context<FundAgreement>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Accepted,
            EscrowError::InvalidState
        );
        let transfer = anchor_lang::system_program::Transfer {
            from: ctx.accounts.requester.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.key(), transfer),
            agreement.amount_lamports,
        )?;
        agreement.delivery_deadline = checked_deadline(
            Clock::get()?.unix_timestamp,
            agreement.delivery_window_seconds,
        )?;
        agreement.status = AgreementStatus::Funded;
        Ok(())
    }

    pub fn submit_work(ctx: Context<SubmitWork>, result_hash: [u8; 32]) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Funded,
            EscrowError::InvalidState
        );
        require_keys_eq!(
            ctx.accounts.provider.key(),
            agreement.provider,
            EscrowError::Unauthorized
        );
        require!(
            Clock::get()?.unix_timestamp <= agreement.delivery_deadline,
            EscrowError::DeadlinePassed
        );
        agreement.submitted_result_hash = result_hash;
        agreement.review_deadline = checked_deadline(
            Clock::get()?.unix_timestamp,
            agreement.review_window_seconds,
        )?;
        agreement.status = AgreementStatus::Submitted;
        Ok(())
    }

    pub fn approve_and_release(ctx: Context<RequesterDecision>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Submitted,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp <= agreement.review_deadline,
            EscrowError::DeadlinePassed
        );
        settle(
            &ctx.accounts.vault,
            &ctx.accounts.provider.to_account_info(),
            agreement.amount_lamports,
        )?;
        agreement.status = AgreementStatus::Settled;
        Ok(())
    }

    pub fn open_dispute(ctx: Context<RequesterDecision>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Submitted,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp <= agreement.review_deadline,
            EscrowError::DeadlinePassed
        );
        agreement.status = AgreementStatus::Disputed;
        agreement.resolver_stage = ResolverStage::Primary;
        agreement.resolver_deadline = checked_deadline(
            Clock::get()?.unix_timestamp,
            agreement.resolver_window_seconds,
        )?;
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: ResolverOutcome) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Disputed,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp <= agreement.resolver_deadline,
            EscrowError::DeadlinePassed
        );
        let expected_resolver = match agreement.resolver_stage {
            ResolverStage::Primary => agreement.primary_resolver,
            ResolverStage::Backup => agreement.backup_resolver,
            ResolverStage::None => return err!(EscrowError::InvalidResolverStage),
        };
        require_keys_eq!(
            ctx.accounts.resolver.key(),
            expected_resolver,
            EscrowError::Unauthorized
        );

        match outcome {
            ResolverOutcome::ReleaseToProvider => {
                settle(
                    &ctx.accounts.vault,
                    &ctx.accounts.provider.to_account_info(),
                    agreement.amount_lamports,
                )?;
                agreement.status = AgreementStatus::Settled;
            }
            ResolverOutcome::RefundRequester => {
                settle(
                    &ctx.accounts.vault,
                    &ctx.accounts.requester.to_account_info(),
                    agreement.amount_lamports,
                )?;
                agreement.status = AgreementStatus::Refunded;
            }
        }
        Ok(())
    }

    pub fn advance_to_backup_resolver(ctx: Context<AdvanceResolver>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Disputed
                && agreement.resolver_stage == ResolverStage::Primary,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp > agreement.resolver_deadline,
            EscrowError::DeadlineNotPassed
        );
        agreement.resolver_stage = ResolverStage::Backup;
        agreement.resolver_deadline = checked_deadline(
            Clock::get()?.unix_timestamp,
            agreement.resolver_window_seconds,
        )?;
        Ok(())
    }

    pub fn refund_after_delivery_timeout(ctx: Context<TimeoutSettlement>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Funded,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp > agreement.delivery_deadline,
            EscrowError::DeadlineNotPassed
        );
        settle(
            &ctx.accounts.vault,
            &ctx.accounts.requester.to_account_info(),
            agreement.amount_lamports,
        )?;
        agreement.status = AgreementStatus::Refunded;
        Ok(())
    }

    pub fn release_after_review_timeout(ctx: Context<TimeoutSettlement>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Submitted,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp > agreement.review_deadline,
            EscrowError::DeadlineNotPassed
        );
        settle(
            &ctx.accounts.vault,
            &ctx.accounts.provider.to_account_info(),
            agreement.amount_lamports,
        )?;
        agreement.status = AgreementStatus::Settled;
        Ok(())
    }

    pub fn refund_after_backup_timeout(ctx: Context<TimeoutSettlement>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Disputed
                && agreement.resolver_stage == ResolverStage::Backup,
            EscrowError::InvalidState
        );
        require!(
            Clock::get()?.unix_timestamp > agreement.resolver_deadline,
            EscrowError::DeadlineNotPassed
        );
        settle(
            &ctx.accounts.vault,
            &ctx.accounts.requester.to_account_info(),
            agreement.amount_lamports,
        )?;
        agreement.status = AgreementStatus::Refunded;
        Ok(())
    }

    pub fn cancel_unfunded(_ctx: Context<CancelUnfunded>) -> Result<()> {
        let agreement = &_ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Proposed
                || agreement.status == AgreementStatus::Accepted,
            EscrowError::InvalidState
        );
        Ok(())
    }

    pub fn close_terminal(_ctx: Context<CloseTerminal>) -> Result<()> {
        let agreement = &_ctx.accounts.agreement;
        require!(
            agreement.status == AgreementStatus::Settled
                || agreement.status == AgreementStatus::Refunded,
            EscrowError::InvalidState
        );
        Ok(())
    }
}

fn checked_deadline(now: i64, duration: i64) -> Result<i64> {
    now.checked_add(duration)
        .ok_or_else(|| error!(EscrowError::TimeOverflow))
}

fn settle<'info>(
    vault: &Account<'info, EscrowVault>,
    recipient: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    require!(recipient.is_writable, EscrowError::RecipientNotWritable);
    let account_info = vault.to_account_info();
    let minimum_balance = Rent::get()?.minimum_balance(8 + EscrowVault::INIT_SPACE);
    let remaining = account_info
        .lamports()
        .checked_sub(amount)
        .ok_or(EscrowError::InsufficientEscrowBalance)?;
    require!(
        remaining >= minimum_balance,
        EscrowError::InsufficientEscrowBalance
    );
    account_info.sub_lamports(amount)?;
    recipient.add_lamports(amount)?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(agreement_id: [u8; 16])]
pub struct CreateAgreement<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(
        init,
        payer = requester,
        space = 8 + Agreement::INIT_SPACE,
        seeds = [b"agreement", requester.key().as_ref(), agreement_id.as_ref()],
        bump
    )]
    pub agreement: Account<'info, Agreement>,
    #[account(
        init,
        payer = requester,
        space = 8 + EscrowVault::INIT_SPACE,
        seeds = [b"vault", agreement.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, EscrowVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptAgreement<'info> {
    pub provider: Signer<'info>,
    #[account(mut, has_one = provider)]
    pub agreement: Account<'info, Agreement>,
}

#[derive(Accounts)]
pub struct FundAgreement<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(mut, has_one = requester)]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    pub provider: Signer<'info>,
    #[account(mut, has_one = provider)]
    pub agreement: Account<'info, Agreement>,
}

#[derive(Accounts)]
pub struct RequesterDecision<'info> {
    pub requester: Signer<'info>,
    /// CHECK: Its key is constrained to the provider recorded in the agreement.
    #[account(mut, address = agreement.provider)]
    pub provider: UncheckedAccount<'info>,
    #[account(mut, has_one = requester)]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub resolver: Signer<'info>,
    /// CHECK: Its key is constrained to the provider recorded in the agreement.
    #[account(mut, address = agreement.provider)]
    pub provider: UncheckedAccount<'info>,
    /// CHECK: Its key is constrained to the requester recorded in the agreement.
    #[account(mut, address = agreement.requester)]
    pub requester: UncheckedAccount<'info>,
    #[account(mut)]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[derive(Accounts)]
pub struct AdvanceResolver<'info> {
    #[account(mut)]
    pub agreement: Account<'info, Agreement>,
}

#[derive(Accounts)]
pub struct TimeoutSettlement<'info> {
    /// CHECK: Its key must match the stored requester; it receives a refund when applicable.
    #[account(mut, address = agreement.requester)]
    pub requester: UncheckedAccount<'info>,
    /// CHECK: Its key must match the stored provider; it receives a release when applicable.
    #[account(mut, address = agreement.provider)]
    pub provider: UncheckedAccount<'info>,
    #[account(mut)]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[derive(Accounts)]
pub struct CancelUnfunded<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(
        mut,
        close = requester,
        seeds = [b"agreement", requester.key().as_ref(), agreement.id.as_ref()],
        bump = agreement.bump,
        has_one = requester
    )]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        close = requester,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[derive(Accounts)]
pub struct CloseTerminal<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(
        mut,
        close = requester,
        seeds = [b"agreement", requester.key().as_ref(), agreement.id.as_ref()],
        bump = agreement.bump,
        has_one = requester
    )]
    pub agreement: Account<'info, Agreement>,
    #[account(
        mut,
        close = requester,
        seeds = [b"vault", agreement.key().as_ref()],
        bump = vault.bump,
        has_one = agreement
    )]
    pub vault: Account<'info, EscrowVault>,
}

#[account]
#[derive(InitSpace)]
pub struct Agreement {
    pub id: [u8; 16],
    pub requester: Pubkey,
    pub provider: Pubkey,
    pub primary_resolver: Pubkey,
    pub backup_resolver: Pubkey,
    pub amount_lamports: u64,
    pub terms_hash: [u8; 32],
    pub status: AgreementStatus,
    pub resolver_stage: ResolverStage,
    pub delivery_window_seconds: i64,
    pub review_window_seconds: i64,
    pub resolver_window_seconds: i64,
    pub delivery_deadline: i64,
    pub review_deadline: i64,
    pub resolver_deadline: i64,
    pub submitted_result_hash: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowVault {
    pub agreement: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum AgreementStatus {
    Proposed,
    Accepted,
    Funded,
    Submitted,
    Disputed,
    Settled,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ResolverStage {
    None,
    Primary,
    Backup,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ResolverOutcome {
    ReleaseToProvider,
    RefundRequester,
}

#[error_code]
pub enum EscrowError {
    #[msg("The amount must be greater than zero.")]
    InvalidAmount,
    #[msg("All time windows must be positive and no longer than one year.")]
    InvalidWindow,
    #[msg("Requester, provider, and resolvers must be distinct addresses.")]
    InvalidRoles,
    #[msg("The agreement is not in a state that permits this action.")]
    InvalidState,
    #[msg("The signer is not authorized for this action.")]
    Unauthorized,
    #[msg("The provided terms hash does not match the agreement.")]
    TermsHashMismatch,
    #[msg("The relevant deadline has passed.")]
    DeadlinePassed,
    #[msg("The relevant deadline has not passed yet.")]
    DeadlineNotPassed,
    #[msg("The agreement has no active resolver stage.")]
    InvalidResolverStage,
    #[msg("The escrow vault does not contain the committed amount above its rent reserve.")]
    InsufficientEscrowBalance,
    #[msg("The payout recipient must be writable.")]
    RecipientNotWritable,
    #[msg("The deadline would overflow the timestamp representation.")]
    TimeOverflow,
}
