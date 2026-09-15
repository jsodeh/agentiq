use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileItem {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub avatar_url: Option<String>,
    pub tier: String,
    pub max_accounts_per_platform: i64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxMessageItem {
    pub id: i64,
    pub profile_id: i64,
    pub title: String,
    pub body: String,
    pub r#type: String,
    pub read: bool,
    pub action_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMemberItem {
    pub id: i64,
    pub profile_id: i64,
    pub name: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
}

pub struct ProfileQueries;

impl ProfileQueries {
    pub fn ensure_default_profile(conn: &Connection) -> Result<ProfileItem> {
        let mut stmt = conn.prepare("SELECT id, user_id, name, avatar_url, tier, max_accounts_per_platform, is_active, created_at FROM profiles WHERE user_id = 1 LIMIT 1")?;
        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(ProfileItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                avatar_url: row.get(3)?,
                tier: row.get(4)?,
                max_accounts_per_platform: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get(7)?,
            })
        } else {
            conn.execute(
                "INSERT INTO profiles (user_id, name, tier, max_accounts_per_platform, is_active) VALUES (1, 'Default Business Profile', 'base', 1, 1)",
                [],
            )?;
            let id = conn.last_insert_rowid();

            // Seed sample inbox messages
            conn.execute(
                "INSERT INTO inbox_messages (profile_id, title, body, type) VALUES (?1, 'Welcome to AgentIQ OS', 'Your workspace profile and autonomous sub-agents are active.', 'info')",
                params![id],
            )?;

            // Seed sample owner team member
            conn.execute(
                "INSERT INTO team_members (profile_id, name, email, role) VALUES (?1, 'Workspace Owner', 'owner@agentiq.ai', 'owner')",
                params![id],
            )?;

            Self::get_profile_by_id(conn, id)
        }
    }

    pub fn get_all_profiles(conn: &Connection) -> Result<Vec<ProfileItem>> {
        Self::ensure_default_profile(conn)?;
        let mut stmt = conn.prepare("SELECT id, user_id, name, avatar_url, tier, max_accounts_per_platform, is_active, created_at FROM profiles ORDER BY id ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(ProfileItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                avatar_url: row.get(3)?,
                tier: row.get(4)?,
                max_accounts_per_platform: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut items = Vec::new();
        for item in rows {
            items.push(item?);
        }
        Ok(items)
    }

    pub fn get_profile_by_id(conn: &Connection, id: i64) -> Result<ProfileItem> {
        conn.query_row(
            "SELECT id, user_id, name, avatar_url, tier, max_accounts_per_platform, is_active, created_at FROM profiles WHERE id = ?1",
            params![id],
            |row| {
                Ok(ProfileItem {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    tier: row.get(4)?,
                    max_accounts_per_platform: row.get(5)?,
                    is_active: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        ).map_err(Into::into)
    }

    pub fn set_active_profile(conn: &Connection, profile_id: i64) -> Result<()> {
        conn.execute("UPDATE profiles SET is_active = 0 WHERE user_id = 1", [])?;
        conn.execute("UPDATE profiles SET is_active = 1 WHERE id = ?1", params![profile_id])?;
        Ok(())
    }

    pub fn create_profile(conn: &Connection, name: &str, tier: &str) -> Result<i64> {
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM profiles WHERE user_id = 1", [], |r| r.get(0))?;
        if tier == "base" && count >= 1 {
            return Err(crate::errors::AppError::Config(
                "Base tier is limited to 1 profile. Upgrade to Pro or Agency tier to manage multiple profiles.".into()
            ));
        }

        conn.execute(
            "INSERT INTO profiles (user_id, name, tier, max_accounts_per_platform, is_active) VALUES (1, ?1, ?2, ?3, 0)",
            params![name, tier, if tier == "base" { 1 } else { 10 }],
        )?;
        let id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO inbox_messages (profile_id, title, body, type) VALUES (?1, 'New Profile Initialized', 'Profile created successfully.', 'info')",
            params![id],
        )?;

        Ok(id)
    }

    pub fn get_inbox_messages(conn: &Connection, profile_id: i64) -> Result<Vec<InboxMessageItem>> {
        let mut stmt = conn.prepare("SELECT id, profile_id, title, body, type, read, action_url, created_at FROM inbox_messages WHERE profile_id = ?1 ORDER BY created_at DESC")?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(InboxMessageItem {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                title: row.get(2)?,
                body: row.get(3)?,
                r#type: row.get(4)?,
                read: row.get(5)?,
                action_url: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut items = Vec::new();
        for item in rows {
            items.push(item?);
        }
        Ok(items)
    }

    pub fn mark_inbox_read(conn: &Connection, message_id: i64) -> Result<()> {
        conn.execute("UPDATE inbox_messages SET read = 1 WHERE id = ?1", params![message_id])?;
        Ok(())
    }

    pub fn get_team_members(conn: &Connection, profile_id: i64) -> Result<Vec<TeamMemberItem>> {
        let mut stmt = conn.prepare("SELECT id, profile_id, name, email, role, status, created_at FROM team_members WHERE profile_id = ?1 ORDER BY id ASC")?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(TeamMemberItem {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                email: row.get(3)?,
                role: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut items = Vec::new();
        for item in rows {
            items.push(item?);
        }
        Ok(items)
    }

    pub fn add_team_member(conn: &Connection, profile_id: i64, name: &str, email: &str, role: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO team_members (profile_id, name, email, role) VALUES (?1, ?2, ?3, ?4)",
            params![profile_id, name, email, role],
        )?;
        Ok(conn.last_insert_rowid())
    }
}
