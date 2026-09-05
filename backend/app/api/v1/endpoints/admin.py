import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.loader import settings
from app.core.dependencies import get_db, require_permission
from app.schemas.user import RoleOut, RoleCreate, PermissionOut, UserOut
from app.repositories.user import UserRepository
from app.repositories.audit import AuditRepository
from app.models.users import User, Role, Permission
from app.schemas.user import UserCreate

router: APIRouter = APIRouter(prefix="/admin", tags=["Admin Portal & Seeding"])

@router.get("/roles", response_model=List[RoleOut])
async def read_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:admin"))
) -> List[Role]:
    """
    List all system roles. Requires 'read:admin' permission.
    """
    user_repo = UserRepository(db)
    return await user_repo.list_roles()

@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_new_role(
    schema: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:admin"))
) -> Role:
    """
    Register a new system role. Requires 'write:admin' permission.
    """
    user_repo = UserRepository(db)
    audit_repo = AuditRepository(db)
    
    existing = await user_repo.get_role_by_name(schema.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name already exists."
        )

    role = await user_repo.create_role(schema)

    # Log audit event
    await audit_repo.log_action(
        actor_id=current_user.id,
        action_type="role_create",
        description=f"Created system role {role.name}",
        resource_id=str(role.id)
    )
    return role

@router.get("/permissions", response_model=List[PermissionOut])
async def read_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:admin"))
) -> List[Permission]:
    """
    List all system permissions. Requires 'read:admin' permission.
    """
    user_repo = UserRepository(db)
    return await user_repo.list_permissions()

@router.post("/seed", response_model=Dict[str, str])
async def seed_database(
    db: AsyncSession = Depends(get_db),
    x_setup_token: Optional[str] = Header(default=None),
) -> Dict[str, str]:
    """
    Seed initial system permissions, roles, and default admin operator.
    Can only be executed if the roles table is empty. When AEGIS_SETUP_TOKEN
    is configured, the matching X-Setup-Token header is additionally required.
    """
    if settings.SETUP_TOKEN and x_setup_token != settings.SETUP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid setup token required."
        )
    user_repo = UserRepository(db)
    audit_repo = AuditRepository(db)

    # Check if roles are already seeded
    existing_roles = await user_repo.list_roles()
    if existing_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database already seeded."
        )

    # 1. Define baseline permissions
    permissions_map = {
        "read:users": "Read system user profiles",
        "write:users": "Create or update system users",
        "delete:users": "Delete system users",
        "read:admin": "Access administrative configuration routes",
        "write:admin": "Update administrative configs and roles",
        "read:transactions": "Read banking transactions telemetry",
        "write:policies": "Modify governance rules and policies",
        "execute:chaos": "Inject failure states on agent suites",
        "execute:agents": "Invoke agent operations"
    }

    db_perms = {}
    for name, desc in permissions_map.items():
        perm = await user_repo.create_permission(name=name, description=desc)
        db_perms[name] = perm

    # 2. Define baseline roles
    # Admin role has all permissions
    admin_role = await user_repo.create_role(
        RoleCreate(
            name="admin",
            description="Super Administrator with full access rights.",
            permission_ids=[p.id for p in db_perms.values()]
        )
    )

    # Auditor role has reading access and transactions
    auditor_role = await user_repo.create_role(
        RoleCreate(
            name="auditor",
            description="Human-in-the-loop reviewer and compliance auditor.",
            permission_ids=[
                db_perms["read:users"].id,
                db_perms["read:admin"].id,
                db_perms["read:transactions"].id,
                db_perms["write:policies"].id
            ]
        )
    )

    # Viewer role has read-only transactions access
    await user_repo.create_role(
        RoleCreate(
            name="viewer",
            description="Read-only operations viewer.",
            permission_ids=[
                db_perms["read:transactions"].id
            ]
        )
    )

    # 3. Create default admin user
    admin_user = await user_repo.create_user(
        UserCreate(
            email="admin@aegisai.bank",
            password="aegisai_admin_password",
            role_id=admin_role.id
        )
    )

    # 4. Audit Seeding
    await audit_repo.log_action(
        actor_id=admin_user.id,
        action_type="database_seed",
        description="System initial database seed completed successfully."
    )

    return {
        "message": "Seeding completed successfully.",
        "admin_email": "admin@aegisai.bank",
        "admin_password": "aegisai_admin_password (Change immediately)"
    }
