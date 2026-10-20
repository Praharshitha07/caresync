import { randomUUID } from 'node:crypto';

export function createAuditedAuthorization(
  AuditModel,
  { roles, action, resource }
) {
  return async function auditAuthorizationDecision(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required',
      });
    }

    const allowed = roles.includes(req.auth.role);
    try {
      await AuditModel.create({
        requestId: randomUUID(),
        actorId: req.auth.userId,
        actorRole: req.auth.role,
        action,
        resource,
        resourceId: req.params.id,
        subjectId: allowed
          ? req.validatedBody?.patientId ||
            (typeof req.body?.patientId === 'string' &&
            /^CS-[A-Z0-9-]{1,29}$/i.test(req.body.patientId)
              ? req.body.patientId
              : undefined) ||
            (resource === 'patients' ? req.params.id : undefined)
          : undefined,
        outcome: allowed ? 'authorization_granted' : 'role_denied',
      });
    } catch (error) {
      return next(error);
    }

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Your role is not authorized for this operation',
      });
    }
    return next();
  };
}
